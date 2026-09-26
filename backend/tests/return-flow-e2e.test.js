jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createProduct,
  createAddress,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

// Buyer places a COD order, admin walks it to DELIVERED — the state a buyer
// has to be in to raise a return.
async function deliveredOrder({ productOverrides = {} } = {}) {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  const { token: adminToken } = await createAdmin();
  const product = await createProduct({ stock: 5, price: 400, isReturnable: true, ...productOverrides });

  await request(app)
    .post('/user/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product._id.toString(), quantity: 1 });
  const placed = await request(app)
    .post('/user/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId: address._id.toString(), paymentMethod: 'COD' });
  expect(placed.status).toBe(201);
  const orderId = placed.body.data.id;

  for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED']) {
    const res = await request(app)
      .patch(`/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status });
    expect(res.status).toBe(200);
  }
  return { user, token, adminToken, product, orderId };
}

function raiseReturn(token, { orderId, productId, requestType, reason = 'Damaged product' }) {
  return request(app)
    .post('/user/returns')
    .set('Authorization', `Bearer ${token}`)
    .field('orderId', orderId)
    .field('productId', productId)
    .field('requestType', requestType)
    .field('reason', reason);
}

const admin = (adminToken) => ({
  decide: (id, body) => request(app).post(`/admin/returns/${id}/decide`).set('Authorization', `Bearer ${adminToken}`).send(body),
  received: (id) => request(app).post(`/admin/returns/${id}/received`).set('Authorization', `Bearer ${adminToken}`).send({}),
  complete: (id, body = {}) => request(app).post(`/admin/returns/${id}/complete`).set('Authorization', `Bearer ${adminToken}`).send(body),
  detail: (id) => request(app).get(`/admin/returns/${id}`).set('Authorization', `Bearer ${adminToken}`),
});

const wallet = async (userId) => (await Customer.findById(userId)).walletBalance || 0;
const stockOf = async (productId) => (await Product.findById(productId)).stock;

describe('return flow, end to end', () => {
  it('refund (COD): approve → item received → complete pays the wallet; no money before the item is back', async () => {
    const { user, token, adminToken, product, orderId } = await deliveredOrder();
    const api = admin(adminToken);

    const raised = await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' });
    expect(raised.status).toBe(201);
    const id = raised.body.data.id;

    // A second request on the same line is refused while the first is open.
    expect((await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' })).status).toBe(400);

    // Reject without a reason: refused.
    expect((await api.decide(id, { decision: 'REJECTED' })).status).toBe(400);

    const before = await wallet(user._id);
    const accepted = await api.decide(id, { decision: 'APPROVED' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('approved');
    // Accepting moves no money.
    expect(await wallet(user._id)).toBe(before);

    // Delivered by hand in this test (no courier parcel) → manual pickup.
    const detail = (await api.detail(id)).body.data;
    expect(detail.progress).toMatchObject({ stage: 'awaiting_item', pickupMode: 'MANUAL', refundDestination: 'WALLET' });

    // Completing before the item is back is refused.
    expect((await api.complete(id)).status).toBe(400);

    // Still blocked for the buyer while in progress.
    expect((await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' })).status).toBe(400);

    expect((await api.received(id)).status).toBe(200);
    expect((await api.detail(id)).body.data.progress.stage).toBe('ready_to_complete');

    const stockBefore = await stockOf(product._id);
    const done = await api.complete(id, { restock: true });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('refunded');

    const saved = await ReturnRequest.findById(id);
    expect(saved).toMatchObject({ status: 'APPROVED', refundDestination: 'WALLET', restocked: true });
    expect(await wallet(user._id)).toBe(before + 400);
    expect(await stockOf(product._id)).toBe(stockBefore + 1);
    expect((await Order.findById(orderId)).refundedAmount).toBe(400);

    // Completing twice cannot pay twice.
    expect((await api.complete(id, { restock: true })).status).toBe(400);
    expect(await wallet(user._id)).toBe(before + 400);

    // Done: the buyer cannot return the same line again.
    const again = await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already been returned/);

    // Buyer sees it completed.
    const mine = await request(app).get('/user/returns').set('Authorization', `Bearer ${token}`);
    expect(mine.body.data.items.find((r) => r.id === id)).toMatchObject({ status: 'APPROVED', refundDestination: 'WALLET' });
  });

  it('refund (Razorpay): the money goes back to the original payment, not the wallet', async () => {
    const { user, token, adminToken, product, orderId } = await deliveredOrder();
    await Order.updateOne({ _id: orderId }, { $set: { paymentMethod: 'RAZORPAY', razorpayPaymentId: 'pay_test_123' } });
    razorpay.payments.refund.mockResolvedValue({ id: 'rfnd_test_1' });
    const api = admin(adminToken);

    const id = (await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' })).body.data.id;
    await api.decide(id, { decision: 'APPROVED' });
    await api.received(id);

    const before = await wallet(user._id);
    const done = await api.complete(id);
    expect(done.status).toBe(200);
    expect(razorpay.payments.refund).toHaveBeenCalledWith('pay_test_123', expect.objectContaining({ amount: 40000 }));
    expect(await wallet(user._id)).toBe(before);
    expect(await ReturnRequest.findById(id)).toMatchObject({ refundDestination: 'RAZORPAY', razorpayRefundId: 'rfnd_test_1' });
  });

  it('refund (Razorpay failure): nothing changes and admin can retry', async () => {
    const { token, adminToken, product, orderId } = await deliveredOrder();
    await Order.updateOne({ _id: orderId }, { $set: { paymentMethod: 'RAZORPAY', razorpayPaymentId: 'pay_test_fail' } });
    razorpay.payments.refund.mockRejectedValueOnce({ error: { description: 'Gateway down' } });
    const api = admin(adminToken);

    const id = (await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' })).body.data.id;
    await api.decide(id, { decision: 'APPROVED' });
    await api.received(id);

    const failed = await api.complete(id);
    expect(failed.status).toBe(502);
    expect(await ReturnRequest.findById(id)).toMatchObject({ status: 'ACCEPTED', completing: false });

    razorpay.payments.refund.mockResolvedValueOnce({ id: 'rfnd_retry' });
    expect((await api.complete(id)).status).toBe(200);
  });

  it('replacement: completion creates a free order for the seller to ship and takes stock', async () => {
    const { user, token, adminToken, product, orderId } = await deliveredOrder();
    const api = admin(adminToken);

    const id = (await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REPLACEMENT' })).body.data.id;
    await api.decide(id, { decision: 'APPROVED' });
    await api.received(id);

    const before = await wallet(user._id);
    const stockBefore = await stockOf(product._id);
    const done = await api.complete(id, { restock: false });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('replacement_issued');

    const saved = await ReturnRequest.findById(id);
    const replacement = await Order.findById(saved.replacementOrder);
    expect(replacement).toMatchObject({ total: 0, paymentStatus: 'PAID', status: 'PENDING' });
    expect(String(replacement.replacementFor)).toBe(id);
    expect(replacement.items[0]).toMatchObject({ quantity: 1, price: 0 });
    expect(await stockOf(product._id)).toBe(stockBefore - 1);
    expect(await wallet(user._id)).toBe(before);
  });

  it('missing item: nothing to send back, so approval completes at once', async () => {
    const { user, token, adminToken, product, orderId } = await deliveredOrder();
    const api = admin(adminToken);
    const id = (await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND', reason: 'Missing Product Accessories' })).body.data.id;

    const before = await wallet(user._id);
    const stockBefore = await stockOf(product._id);
    const res = await api.decide(id, { decision: 'APPROVED', requireItemBack: false, restock: true });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('refunded');
    expect(await wallet(user._id)).toBe(before + 400);
    // Nothing came back, so nothing is restocked.
    expect(await stockOf(product._id)).toBe(stockBefore);
  });

  it('rejected after inspection: no money, and the buyer is told why', async () => {
    const { user, token, adminToken, product, orderId } = await deliveredOrder();
    const api = admin(adminToken);
    const id = (await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' })).body.data.id;
    await api.decide(id, { decision: 'APPROVED' });
    await api.received(id);

    const before = await wallet(user._id);
    const res = await api.decide(id, { decision: 'REJECTED', reason: 'Item came back used' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Item came back used' });
    expect(await wallet(user._id)).toBe(before);
  });

  it('a non-returnable product offers no return and refuses one', async () => {
    const { token, product, orderId } = await deliveredOrder({ productOverrides: { isReturnable: false } });
    const detail = await request(app).get(`/user/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.data.canReturn).toBe(false);
    const raised = await raiseReturn(token, { orderId, productId: product._id.toString(), requestType: 'REFUND' });
    expect(raised.status).toBe(403);
  });
});
