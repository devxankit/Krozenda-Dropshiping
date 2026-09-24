// CJ Dropshipping checkout rules (business decision, 2026-09) and the money
// fixes that came with them.
//
//   * a dropship item can only be paid online — no COD, no wallet
//   * a cart with dropship AND seller items is placed as two orders, paid by
//     one Razorpay payment
//   * CJ refusing the order after payment refunds the buyer automatically
//   * the buyer can neither cancel nor return a dropship order
//   * a return refunds what the buyer paid for the line, coupon included
//   * one seller's coupon never comes out of another seller's line
jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));
jest.mock('../services/cj/cjOrderService', () => ({
  createOrder: jest.fn(),
  cancelOrder: jest.fn(),
  refreshOrderStatus: jest.fn(),
  CjOrderError: class CjOrderError extends Error {},
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const cjOrderService = require('../services/cj/cjOrderService');
const Order = require('../Models/Order');
const Coupon = require('../Models/Coupon');
const CjOrder = require('../Models/CjOrder');
const ShippingSettings = require('../Models/ShippingSettings');
const AccountingTransaction = require('../Models/AccountingTransaction');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const { computeSellingPrice } = require('../services/cj/cjOnboardingService');
const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createProduct,
  createAddress,
  createVendor,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.clearAllMocks());

// Carrier quoting is out of scope here: shipping off, so every total is items
// minus discount. `updatedBy` keeps getSettings() from switching it back on.
beforeEach(async () => {
  await ShippingSettings.deleteMany({});
  await ShippingSettings.create({
    key: 'GLOBAL',
    shippingEnabled: false,
    sellerOwnAccountEnabled: false,
    updatedBy: '650000000000000000000001',
  });
  cjOrderService.createOrder.mockResolvedValue({ cjOrderId: 'CJ123' });
  razorpay.payments.refund.mockResolvedValue({ id: 'rfnd_1' });
});

let seq = 0;
const unique = () => `${Date.now()}${(seq += 1)}`;

// A CJ product with two colour variants, mapped to two CJ variants.
async function createCjProduct({ price = 500 } = {}) {
  const product = await createProduct({
    price,
    stock: 20,
    vendor: null,
    fulfillmentProvider: 'CJ',
    variants: [
      { name: 'White', price, stock: 10, isActive: true },
      { name: 'Black', price, stock: 10, isActive: true },
    ],
  });
  await ProductFulfillmentMapping.create({
    product: product._id,
    provider: 'CJ',
    cjProductId: `CJP${unique()}`,
    variants: product.variants.map((v, i) => ({
      krozendaVariantId: v._id,
      cjVariantId: `CJV-${i}-${unique()}`,
      providerCost: 3,
    })),
  });
  return product;
}

async function addToCart(token, productId, { quantity = 1, variantId } = {}) {
  const res = await request(app)
    .post('/user/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: String(productId), quantity, ...(variantId ? { variantId: String(variantId) } : {}) });
  expect(res.status).toBeLessThan(300);
  return res;
}

async function buyer() {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id);
  return { user, token, address };
}

function razorpayBody(total) {
  const razorpayOrderId = `order_${unique()}`;
  const razorpayPaymentId = `pay_${unique()}`;
  razorpay.payments.fetch.mockResolvedValue({
    order_id: razorpayOrderId,
    status: 'captured',
    amount: Math.round(total * 100),
  });
  return {
    paymentMethod: 'RAZORPAY',
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex'),
  };
}

function placeOrder(token, address, body) {
  return request(app)
    .post('/user/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId: address._id.toString(), ...body });
}

describe('dropship items are online-payment only', () => {
  it.each(['COD', 'WALLET'])('refuses %s for a cart with a dropship item', async (method) => {
    const { user, token, address } = await buyer();
    const product = await createCjProduct();
    await addToCart(token, product._id, { variantId: product.variants[0]._id });

    const res = await placeOrder(token, address, { paymentMethod: method });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ONLINE_PAYMENT_REQUIRED');
    expect(await Order.countDocuments({ user: user._id })).toBe(0);
    expect(cjOrderService.createOrder).not.toHaveBeenCalled();
  });

  it('marks COD and wallet unavailable in the checkout quote', async () => {
    const { token, address } = await buyer();
    const product = await createCjProduct();
    await addToCart(token, product._id, { variantId: product.variants[0]._id });

    const res = await request(app)
      .post('/user/orders/shipping-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'RAZORPAY' });

    expect(res.status).toBe(200);
    expect(res.body.data.onlineOnly).toBe(true);
    expect(res.body.data.methods.RAZORPAY.available).toBe(true);
    expect(res.body.data.methods.COD).toMatchObject({ available: false, reason: 'ONLINE_PAYMENT_REQUIRED' });
    expect(res.body.data.methods.WALLET).toMatchObject({ available: false, reason: 'ONLINE_PAYMENT_REQUIRED' });
  });
});

describe('mixed cart', () => {
  it('is placed as a STANDARD and a DROPSHIP order on one payment, and CJ gets the chosen variant', async () => {
    const { token, address } = await buyer();
    const { vendor } = await createVendor();
    const sellerProduct = await createProduct({ price: 1000, stock: 5, vendor: vendor._id });
    const cjProduct = await createCjProduct({ price: 500 });
    const black = cjProduct.variants[1];

    await addToCart(token, sellerProduct._id);
    await addToCart(token, cjProduct._id, { quantity: 2, variantId: black._id });

    const body = razorpayBody(2000);
    const res = await placeOrder(token, address, body);
    expect(res.status).toBe(201);

    const orders = res.body.data.orders;
    expect(orders).toHaveLength(2);
    const standard = orders.find((o) => o.fulfillmentType === 'STANDARD');
    const dropship = orders.find((o) => o.fulfillmentType === 'DROPSHIP');
    expect(standard.total).toBe(1000);
    expect(dropship.total).toBe(1000);
    expect(dropship.isDropship).toBe(true);
    expect(standard.checkoutGroupId).toBe(dropship.checkoutGroupId);

    const stored = await Order.find({ checkoutGroupId: dropship.checkoutGroupId });
    expect(new Set(stored.map((o) => o.razorpayPaymentId)).size).toBe(1);

    // Black, not the first variant.
    const mapping = await ProductFulfillmentMapping.findOne({ product: cjProduct._id });
    const blackCj = mapping.variants.find((v) => String(v.krozendaVariantId) === String(black._id));
    expect(cjOrderService.createOrder).toHaveBeenCalledTimes(1);
    expect(cjOrderService.createOrder.mock.calls[0][0].items).toEqual([
      expect.objectContaining({ cjVariantId: blackCj.cjVariantId, quantity: 2 }),
    ]);
  });

  it('a repeated submission with the same key returns both orders, not four', async () => {
    const { token, address } = await buyer();
    const sellerProduct = await createProduct({ price: 300, stock: 5 });
    const cjProduct = await createCjProduct({ price: 200 });
    await addToCart(token, sellerProduct._id);
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });

    const body = { ...razorpayBody(500), idempotencyKey: `key_${unique()}` };
    const first = await placeOrder(token, address, body);
    expect(first.status).toBe(201);
    const again = await placeOrder(token, address, body);

    expect(again.status).toBe(200);
    expect(again.body.data.orders).toHaveLength(2);
    expect(await Order.countDocuments({ idempotencyKey: body.idempotencyKey })).toBe(2);
  });
});

describe('CJ refusing a paid order', () => {
  it('cancels and refunds only the dropship order, to the original payment', async () => {
    cjOrderService.createOrder.mockRejectedValue(Object.assign(new Error('out of stock'), { code: 'CJ_ORDER_CREATE_FAILED' }));

    const { token, address } = await buyer();
    const sellerProduct = await createProduct({ price: 800, stock: 5 });
    const cjProduct = await createCjProduct({ price: 450 });
    await addToCart(token, sellerProduct._id);
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });

    const body = razorpayBody(1250);
    const res = await placeOrder(token, address, body);
    expect(res.status).toBe(201);

    const dropship = res.body.data.orders.find((o) => o.isDropship);
    const standard = res.body.data.orders.find((o) => !o.isDropship);
    expect(dropship.status).toBe('CANCELLED');
    expect(dropship.paymentStatus).toBe('REFUNDED');
    expect(standard.status).toBe('PENDING');
    expect(standard.paymentStatus).toBe('PAID');

    expect(razorpay.payments.refund).toHaveBeenCalledTimes(1);
    const [paymentId, refund] = razorpay.payments.refund.mock.calls[0];
    expect(paymentId).toBe(body.razorpay_payment_id);
    expect(refund.amount).toBe(45000);
    expect(refund.notes.orderId).toBe(dropship.id);
  });

  it('leaves a timed-out order alone for reconciliation instead of refunding', async () => {
    cjOrderService.createOrder.mockRejectedValue(
      Object.assign(new Error('timed out'), { code: 'CJ_ORDER_RECONCILIATION_REQUIRED' })
    );
    const { token, address } = await buyer();
    const cjProduct = await createCjProduct({ price: 300 });
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });

    const res = await placeOrder(token, address, razorpayBody(300));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });
});

describe('what the buyer cannot do with a dropship order', () => {
  async function placedDropshipOrder() {
    const { token, address } = await buyer();
    const cjProduct = await createCjProduct({ price: 300 });
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });
    const res = await placeOrder(token, address, razorpayBody(300));
    expect(res.status).toBe(201);
    return { token, order: res.body.data, cjProduct };
  }

  it('cannot cancel it', async () => {
    const { token, order } = await placedDropshipOrder();
    const res = await request(app).patch(`/user/orders/${order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DROPSHIP_NOT_CANCELLABLE');
    expect((await Order.findById(order.id)).status).toBe('PENDING');
  });

  it('cannot return it, and it is not offered as returnable', async () => {
    const { token, order, cjProduct } = await placedDropshipOrder();
    await Order.updateOne({ _id: order.id }, { $set: { status: 'DELIVERED', deliveredAt: new Date() } });

    const list = await request(app).get('/user/returns/returnable').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.items).toHaveLength(0);

    const res = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${token}`)
      .field('orderId', order.id)
      .field('productId', String(cjProduct._id))
      .field('variantId', String(cjProduct.variants[0]._id))
      .field('requestType', 'REFUND')
      .field('reason', 'Changed my mind');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('DROPSHIP_NOT_RETURNABLE');
  });
});

describe('admin cancelling a dropship order', () => {
  it('cancels at CJ, then refunds the buyer to the original payment', async () => {
    const { token: adminToken } = await createAdmin();
    const { token, address } = await buyer();
    const cjProduct = await createCjProduct({ price: 600 });
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });
    const payment = razorpayBody(600);
    const placed = await placeOrder(token, address, payment);
    expect(placed.status).toBe(201);

    // What cjOrderService.createOrder would have written.
    await CjOrder.create({
      krozendaOrderId: placed.body.data.id,
      krozendaSubOrderId: `CJ-${placed.body.data.id}`,
      cjOrderId: 'CJ-ORDER-1',
      status: 'CONFIRMED',
    });

    const res = await request(app)
      .patch(`/admin/orders/${placed.body.data.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(cjOrderService.cancelOrder).toHaveBeenCalledWith('CJ-ORDER-1');
    expect(razorpay.payments.refund).toHaveBeenCalledWith(
      payment.razorpay_payment_id,
      expect.objectContaining({ amount: 60000 })
    );
    const order = await Order.findById(placed.body.data.id);
    expect(order.status).toBe('CANCELLED');
    expect(order.paymentStatus).toBe('REFUNDED');
    expect(order.cancelledBy).toBe('admin');
  });

  it('refunds nothing when CJ refuses the cancellation', async () => {
    cjOrderService.cancelOrder.mockRejectedValue(Object.assign(new Error('already shipped'), { status: 400 }));
    const { token: adminToken } = await createAdmin();
    const { token, address } = await buyer();
    const cjProduct = await createCjProduct({ price: 250 });
    await addToCart(token, cjProduct._id, { variantId: cjProduct.variants[0]._id });
    const placed = await placeOrder(token, address, razorpayBody(250));
    await CjOrder.create({
      krozendaOrderId: placed.body.data.id,
      krozendaSubOrderId: `CJ-${placed.body.data.id}`,
      cjOrderId: 'CJ-ORDER-2',
      status: 'CONFIRMED',
    });

    const res = await request(app)
      .patch(`/admin/orders/${placed.body.data.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
    expect((await Order.findById(placed.body.data.id)).status).toBe('PENDING');
  });
});

describe('non-returnable products', () => {
  it('a product marked non-returnable is not offered for return and cannot be returned', async () => {
    const { token, address } = await buyer();
    const product = await createProduct({ price: 400, stock: 5, isReturnable: false });
    await addToCart(token, product._id);

    const placed = await placeOrder(token, address, razorpayBody(400));
    expect(placed.status).toBe(201);
    await Order.updateOne({ _id: placed.body.data.id }, { $set: { status: 'DELIVERED', deliveredAt: new Date() } });

    const list = await request(app).get('/user/returns/returnable').set('Authorization', `Bearer ${token}`);
    expect(list.body.data.items.find((i) => i.orderId === placed.body.data.id)).toBeUndefined();

    const res = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${token}`)
      .field('orderId', placed.body.data.id)
      .field('productId', String(product._id))
      .field('requestType', 'REFUND')
      .field('reason', 'Changed my mind');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_RETURNABLE');
  });

  it('turning returns off after purchase does not take them away from that order', async () => {
    const { token, address } = await buyer();
    const product = await createProduct({ price: 300, stock: 5 });
    await addToCart(token, product._id);

    const placed = await placeOrder(token, address, razorpayBody(300));
    expect(placed.status).toBe(201);
    await Order.updateOne({ _id: placed.body.data.id }, { $set: { status: 'DELIVERED', deliveredAt: new Date() } });
    product.isReturnable = false;
    await product.save();

    const res = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${token}`)
      .field('orderId', placed.body.data.id)
      .field('productId', String(product._id))
      .field('requestType', 'REFUND')
      .field('reason', 'Damaged');
    expect(res.status).toBe(201);
  });
});

describe('coupon money', () => {
  it('a return refunds what was actually paid for the line, not its list price', async () => {
    const code = `TENOFF${unique().slice(-6)}`;
    await Coupon.create({
      code,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const { token, address } = await buyer();
    const product = await createProduct({ price: 1000, stock: 5 });
    await addToCart(token, product._id);

    const placed = await placeOrder(token, address, { ...razorpayBody(900), couponCode: code });
    expect(placed.status).toBe(201);
    await Order.updateOne({ _id: placed.body.data.id }, { $set: { status: 'DELIVERED', deliveredAt: new Date() } });

    const res = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${token}`)
      .field('orderId', placed.body.data.id)
      .field('productId', String(product._id))
      .field('requestType', 'REFUND')
      .field('reason', 'Damaged');

    expect(res.status).toBe(201);
    expect(res.body.data.refundAmount).toBe(900);
  });

  it("one seller's coupon never comes out of another seller's line", async () => {
    const { vendor: sellerA } = await createVendor();
    const { vendor: sellerB } = await createVendor();
    const productA = await createProduct({ price: 1000, stock: 5, vendor: sellerA._id });
    const productB = await createProduct({ price: 1000, stock: 5, vendor: sellerB._id });

    const code = `SELLERA${unique().slice(-6)}`;
    await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 100,
      applicableTo: 'PRODUCTS',
      productIds: [productA._id],
      vendorId: sellerA._id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });

    const { token, address } = await buyer();
    await addToCart(token, productA._id);
    await addToCart(token, productB._id);
    const placed = await placeOrder(token, address, { ...razorpayBody(1900), couponCode: code });
    expect(placed.status).toBe(201);

    const sales = await AccountingTransaction.find({ order: placed.body.data.id, type: 'SALE' }).lean();
    const saleFor = (vendor) => sales.find((row) => String(row.vendor) === String(vendor._id));
    expect(saleFor(sellerA).credit).toBe(90000);
    // Seller B's coupon exposure is zero: paid in full.
    expect(saleFor(sellerB).credit).toBe(100000);
  });
});

describe('two variants of one product on one order', () => {
  it('reverses both lines when the order is cancelled', async () => {
    const { vendor } = await createVendor();
    const product = await createProduct({
      price: 400,
      stock: 10,
      vendor: vendor._id,
      variants: [
        { name: 'Red', price: 400, stock: 5, isActive: true },
        { name: 'Blue', price: 400, stock: 5, isActive: true },
      ],
    });
    const { token, address } = await buyer();
    await addToCart(token, product._id, { variantId: product.variants[0]._id });
    await addToCart(token, product._id, { variantId: product.variants[1]._id });

    const placed = await placeOrder(token, address, razorpayBody(800));
    expect(placed.status).toBe(201);

    const res = await request(app)
      .patch(`/user/orders/${placed.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const refunds = await AccountingTransaction.find({ order: placed.body.data.id, type: 'REFUND' }).lean();
    expect(refunds).toHaveLength(2);
    expect(refunds.reduce((sum, row) => sum + row.debit, 0)).toBe(80000);
  });
});

describe('CJ selling price', () => {
  it('is cost plus margin — shipping is charged at checkout, not baked in', () => {
    const price = computeSellingPrice({
      pricingMode: 'AUTOMATIC',
      marginRule: { type: 'PERCENT', value: 30 },
      providerCost: 10,
      providerShippingCost: 5,
      priceRounding: 'NONE',
    });
    // 10 USD at the configured rate, + 30%. Shipping (5 USD) is not in it.
    expect(price).toBeCloseTo(10 * USD_TO_INR_RATE * 1.3, 2);
  });
});
