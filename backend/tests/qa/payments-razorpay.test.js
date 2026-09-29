// QA audit — Razorpay checkout, wallet top-up and payment webhooks.
//
// Razorpay itself is mocked (Config/razorpay): no network, no real money.
// Signatures are computed with the same secret the server reads, so the
// server's HMAC checks run for real.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const crypto = require('crypto');
const razorpay = require('../../Config/razorpay');
const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Customer = require('../../Models/Customer');
const {
  connectTestDb,
  disconnectTestDb,
  createProduct,
  createVendor,
  buyerWithAddress,
  addToCart,
  as,
  app,
  knownBug,
} = require('./qaHelpers');
const request = require('supertest');

const KEY_SECRET = 'qa_key_secret';
const WEBHOOK_SECRET = 'qa_webhook_secret';
const savedEnv = { ...process.env };

beforeAll(async () => {
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  await connectTestDb();
});
afterAll(async () => {
  process.env = savedEnv;
  await disconnectTestDb();
});
afterEach(() => jest.clearAllMocks());

let seq = 0;
function paymentIds() {
  seq += 1;
  const orderId = `order_QA${Date.now()}${seq}`;
  const paymentId = `pay_QA${Date.now()}${seq}`;
  const signature = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature };
}

function captured(ids, amountPaise, extra = {}) {
  return { id: ids.razorpay_payment_id, order_id: ids.razorpay_order_id, status: 'captured', amount: amountPaise, ...extra };
}

async function quoteTotal(token, addressId) {
  const q = await as(token).post('/user/orders/shipping-quote', { addressId: String(addressId), paymentMethod: 'RAZORPAY' });
  expect(q.status).toBe(200);
  return q.body.data.total;
}

function webhook(body, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return request(app).post('/webhook/payments').set('Content-Type', 'application/json').set('x-razorpay-signature', sig).send(raw);
}

describe('checkout payment verification', () => {
  let buyer;
  let product;
  beforeEach(async () => {
    product = await createProduct({ stock: 5, price: 1000, gstRate: 0 });
    buyer = await buyerWithAddress();
    await addToCart(buyer.token, product._id, 1);
  });

  test('the Razorpay order is created for the SERVER total, whatever the client claims', async () => {
    razorpay.orders.create.mockResolvedValue({ id: 'order_x', currency: 'INR' });
    const total = await quoteTotal(buyer.token, buyer.address._id);
    const res = await as(buyer.token).post('/user/orders/razorpay-order', { addressId: String(buyer.address._id), amount: 1 });
    expect(res.status).toBe(200);
    expect(razorpay.orders.create).toHaveBeenCalledWith(expect.objectContaining({ amount: Math.round(total * 100) }));
  });

  test('happy path: verified, captured, full amount → PAID order', async () => {
    const ids = paymentIds();
    const total = await quoteTotal(buyer.token, buyer.address._id);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(total * 100)));
    const res = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'RAZORPAY', ...ids });
    expect(res.status).toBe(201);
    expect(res.body.data.paymentStatus).toBe('PAID');
  });

  test.each([
    ['a forged signature', (ids) => ({ ...ids, razorpay_signature: 'f'.repeat(64) }), null],
    ['missing fields', (ids) => ({ razorpay_order_id: ids.razorpay_order_id }), null],
    ['an underpaid capture (₹1 short)', (ids) => ids, (ids, t) => captured(ids, Math.round(t * 100) - 100)],
    ['a capture for a different Razorpay order', (ids) => ids, (ids, t) => captured(ids, Math.round(t * 100), { order_id: 'order_OTHER' })],
    ['an authorized-but-not-captured payment', (ids) => ids, (ids, t) => captured(ids, Math.round(t * 100), { status: 'authorized' })],
    ['a payment Razorpay cannot find', (ids) => ids, 'reject'],
  ])('%s is refused with 400, and no order or stock change', async (_label, body, fetched) => {
    const ids = paymentIds();
    const total = await quoteTotal(buyer.token, buyer.address._id);
    if (fetched === 'reject') razorpay.payments.fetch.mockRejectedValue(new Error('not found'));
    else if (fetched) razorpay.payments.fetch.mockResolvedValue(fetched(ids, total));
    const res = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'RAZORPAY', ...body(ids) });
    expect(res.status).toBe(400);
    expect(await Order.countDocuments({ user: buyer.user._id })).toBe(0);
    expect((await Product.findById(product._id)).stock).toBe(5);
  });

  test('one captured payment cannot pay for a second checkout (replay → 409, stock released)', async () => {
    const ids = paymentIds();
    const total = await quoteTotal(buyer.token, buyer.address._id);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(total * 100)));
    expect((await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'RAZORPAY', ...ids })).status).toBe(201);

    await addToCart(buyer.token, product._id, 1);
    const replay = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'RAZORPAY', ...ids });
    expect(replay.status).toBe(409);
    expect(await Order.countDocuments({ user: buyer.user._id })).toBe(1);
    expect((await Product.findById(product._id)).stock).toBe(4);
  });

  test('stock lost between capture and order → automatic full refund, 409', async () => {
    const ids = paymentIds();
    const total = await quoteTotal(buyer.token, buyer.address._id);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(total * 100)));
    razorpay.payments.refund.mockResolvedValue({ id: 'rfnd_1' });
    // Someone else buys the last units after the buyer's cart was validated.
    const spy = jest.spyOn(Product, 'findOneAndUpdate').mockResolvedValueOnce(null);
    const res = await as(buyer.token).post('/user/orders', { addressId: String(buyer.address._id), paymentMethod: 'RAZORPAY', ...ids });
    spy.mockRestore();
    expect(res.status).toBe(409);
    expect(razorpay.payments.refund).toHaveBeenCalledWith(ids.razorpay_payment_id, expect.objectContaining({ amount: Math.round(total * 100) }));
  });
});

describe('wallet top-up', () => {
  // A top-up is only creditable once the buyer has opened it (POST
  // /topup/order records it as PENDING); verify claims that row.
  async function openTopup(token, ids, amount) {
    razorpay.orders.create.mockResolvedValueOnce({ id: ids.razorpay_order_id, currency: 'INR' });
    const res = await as(token).post('/user/wallet/topup/order', { amount });
    expect(res.status).toBe(200);
  }

  test('a forged top-up signature credits nothing', async () => {
    const b = await buyerWithAddress();
    const ids = paymentIds();
    await openTopup(b.token, ids, 500);
    const res = await as(b.token).post('/user/wallet/topup/verify', { ...ids, razorpay_signature: '0'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await Customer.findById(b.user._id)).walletBalance || 0).toBe(0);
  });

  test('the credited amount comes from Razorpay, never the client', async () => {
    const b = await buyerWithAddress();
    const ids = paymentIds();
    await openTopup(b.token, ids, 500);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, 50000));
    const res = await as(b.token).post('/user/wallet/topup/verify', { ...ids, amount: 999999 });
    expect(res.status).toBe(200);
    expect((await Customer.findById(b.user._id)).walletBalance).toBe(500);
  });

  test('an opened-but-unpaid top-up is not shown in wallet history', async () => {
    const b = await buyerWithAddress();
    await openTopup(b.token, paymentIds(), 500);
    const res = await as(b.token).get('/user/wallet');
    expect(res.body.data.transactions).toHaveLength(0);
  });

  // Regression for QA-007 (was: every replay credited again).
  test('QA-007: replaying the SAME top-up verification credits the wallet once', async () => {
    await require('../../Models/WalletTransaction').init();
    const b = await buyerWithAddress();
    const ids = paymentIds();
    await openTopup(b.token, ids, 500);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, 50000));
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await as(b.token).post('/user/wallet/topup/verify', ids));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(results.slice(1).every((r) => r.body.message === 'Wallet already topped up')).toBe(true);
    expect((await Customer.findById(b.user._id)).walletBalance).toBe(500);
  });

  test('QA-007: parallel replays of one top-up credit it once', async () => {
    const b = await buyerWithAddress();
    const ids = paymentIds();
    await openTopup(b.token, ids, 300);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, 30000));
    await Promise.all(Array.from({ length: 6 }, () => as(b.token).post('/user/wallet/topup/verify', ids)));
    expect((await Customer.findById(b.user._id)).walletBalance).toBe(300);
  });

  // Regression for QA-008 (was: an order payment could also be credited).
  test('QA-008: a payment captured for an ORDER cannot also be credited to the wallet', async () => {
    const product = await createProduct({ stock: 5, price: 1000, gstRate: 0 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    const ids = paymentIds();
    const total = await quoteTotal(b.token, b.address._id);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(total * 100)));
    expect((await as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'RAZORPAY', ...ids })).status).toBe(201);

    const res = await as(b.token).post('/user/wallet/topup/verify', ids);
    expect(res.status).toBe(400);
    expect((await Customer.findById(b.user._id)).walletBalance || 0).toBe(0);
  });

  test('QA-008: buyer B cannot redeem a top-up buyer A opened and paid', async () => {
    const a = await buyerWithAddress();
    const bb = await buyerWithAddress();
    const ids = paymentIds();
    await openTopup(a.token, ids, 500);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, 50000));
    const res = await as(bb.token).post('/user/wallet/topup/verify', ids);
    expect(res.status).toBe(400);
    expect((await Customer.findById(bb.user._id)).walletBalance || 0).toBe(0);
    // A can still claim their own
    expect((await as(a.token).post('/user/wallet/topup/verify', ids)).status).toBe(200);
    expect((await Customer.findById(a.user._id)).walletBalance).toBe(500);
  });
});

describe('payment webhook', () => {
  test('bad signature → 401, nothing changes', async () => {
    const res = await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x' } } } }, 'wrong-secret');
    expect(res.status).toBe(401);
  });

  test('unsigned → 401', async () => {
    const res = await request(app).post('/webhook/payments').send({ event: 'payment.captured' });
    expect(res.status).toBe(401);
  });

  test('no secret configured → fails closed (503)', async () => {
    const prev = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const res = await webhook({ event: 'payment.captured' });
    process.env.RAZORPAY_WEBHOOK_SECRET = prev;
    expect(res.status).toBe(503);
  });

  test('payment.captured is idempotent: delivered 3× it reconciles a PENDING order once', async () => {
    const product = await createProduct({ stock: 5, price: 100 });
    const b = await buyerWithAddress();
    const order = await Order.create({
      user: b.user._id,
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1 }],
      shippingAddress: { fullName: 'x', phone: '9', line1: 'l', city: 'c', state: 's', pincode: '1' },
      subtotal: 100,
      total: 100,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      razorpayPaymentId: `pay_WH${Date.now()}`,
    });
    const body = { event: 'payment.captured', payload: { payment: { entity: { id: order.razorpayPaymentId, amount: 10000 } } } };
    for (let i = 0; i < 3; i += 1) expect((await webhook(body)).status).toBe(200);
    const fresh = await Order.findById(order._id);
    expect(fresh.paymentStatus).toBe('PAID');
    expect(fresh.statusHistory).toHaveLength(order.statusHistory.length);
  });

  test('an unknown event is acknowledged (200) and ignored', async () => {
    expect((await webhook({ event: 'invoice.paid', payload: {} })).status).toBe(200);
  });
});

describe('partial refund reconciliation (multi-seller order)', () => {
  test(
    'QA-009 (regression): a partial return refund on one seller’s line does not mark the whole order REFUNDED, so the other seller’s later cancellation still refunds',
    async () => {
      const sellerA = await createVendor({ verificationStatus: 'APPROVED' });
      const sellerB = await createVendor({ verificationStatus: 'APPROVED' });
      const pA = await createProduct({ vendor: sellerA.vendor._id, stock: 5, price: 1000, gstRate: 0 });
      const pB = await createProduct({ vendor: sellerB.vendor._id, stock: 5, price: 600, gstRate: 0 });
      const b = await buyerWithAddress();
      await addToCart(b.token, pA._id, 1);
      await addToCart(b.token, pB._id, 1);
      const ids = paymentIds();
      const total = await quoteTotal(b.token, b.address._id);
      razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(total * 100)));
      const placed = await as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'RAZORPAY', ...ids });
      expect(placed.status).toBe(201);
      const orderId = placed.body.data.id;

      // Razorpay confirms a ₹1000 refund for seller A's returned line.
      await webhook({
        event: 'refund.processed',
        payload: { refund: { entity: { id: `rfnd_${Date.now()}`, payment_id: ids.razorpay_payment_id, amount: 100000, notes: { orderId } } } },
      });
      expect((await Order.findById(orderId)).paymentStatus).toBe('PAID');

      // Seller B then rejects their still-unshipped line: the buyer must get ₹600 back.
      const before = (await Customer.findById(b.user._id)).walletBalance || 0;
      const rej = await as(sellerB.token).patch(`/vendor/orders/${orderId}/items/${pB._id}/status`, { status: 'CANCELLED', reason: 'out of stock' });
      expect(rej.status).toBe(200);
      const after = (await Customer.findById(b.user._id)).walletBalance || 0;
      expect(after - before).toBeCloseTo(600, 2);
    }
  );

  async function paidOrder(total) {
    const product = await createProduct({ stock: 5, price: total, gstRate: 0 });
    const b = await buyerWithAddress();
    await addToCart(b.token, product._id, 1);
    const ids = paymentIds();
    const t = await quoteTotal(b.token, b.address._id);
    razorpay.payments.fetch.mockResolvedValue(captured(ids, Math.round(t * 100)));
    const placed = await as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'RAZORPAY', ...ids });
    return { orderId: placed.body.data.id, ids, total: t };
  }
  const refundWebhook = (ids, orderId, amountPaise) =>
    webhook({
      event: 'refund.processed',
      payload: { refund: { entity: { id: `rfnd_${Date.now()}${Math.random()}`, payment_id: ids.razorpay_payment_id, amount: amountPaise, notes: { orderId } } } },
    });

  test('a refund for the full amount still marks the order REFUNDED', async () => {
    const { orderId, ids, total } = await paidOrder(800);
    await refundWebhook(ids, orderId, Math.round(total * 100));
    expect((await Order.findById(orderId)).paymentStatus).toBe('REFUNDED');
  });

  test('partial refunds that add up to the total mark it REFUNDED on the last one', async () => {
    const { orderId, ids, total } = await paidOrder(800);
    await Order.updateOne({ _id: orderId }, { $set: { refundedAmount: total / 2 } });
    await refundWebhook(ids, orderId, Math.round((total / 2) * 100));
    expect((await Order.findById(orderId)).paymentStatus).toBe('PAID');
    await Order.updateOne({ _id: orderId }, { $set: { refundedAmount: total } });
    await refundWebhook(ids, orderId, Math.round((total / 2) * 100));
    expect((await Order.findById(orderId)).paymentStatus).toBe('REFUNDED');
  });
});
