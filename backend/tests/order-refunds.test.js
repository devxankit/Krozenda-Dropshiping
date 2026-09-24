// Money going back to the buyer on a STANDARD order — exactly once, and
// exactly what they paid.
//
//   * cancelling ONE line (seller rejection, admin sub-order cancel) refunds
//     that line; it used to put the stock back and keep the money
//   * a later whole-order cancel refunds only what is left, and does not put
//     the stock of an already-cancelled line back a second time
//   * the manual "refund this cancellation" button pays once however often
//     it is pressed
//   * the new-customer check, the free-delivery threshold, and CJ freight
jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Coupon = require('../Models/Coupon');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const ShippingSettings = require('../Models/ShippingSettings');
const serviceabilityService = require('../services/shipping/serviceabilityService');
const cjLogisticsService = require('../services/cj/cjLogisticsService');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const { shortVariantLabels } = require('../utils/variantLabels');
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
afterEach(() => jest.restoreAllMocks());

let seq = 0;
const unique = () => `${Date.now()}${(seq += 1)}`;

async function buyer({ walletBalance = 0 } = {}) {
  const { user, token } = await createCustomer();
  if (walletBalance) await Customer.updateOne({ _id: user._id }, { $set: { walletBalance } });
  const address = await createAddress(user._id);
  return { user, token, address };
}

async function addToCart(token, productId, extra = {}) {
  const res = await request(app)
    .post('/user/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: String(productId), quantity: 1, ...extra });
  expect(res.status).toBeLessThan(300);
}

function razorpayBody(total) {
  const razorpayOrderId = `order_${unique()}`;
  const razorpayPaymentId = `pay_${unique()}`;
  razorpay.payments.fetch.mockResolvedValue({ order_id: razorpayOrderId, status: 'captured', amount: Math.round(total * 100) });
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

async function placePaidOrder({ token, address, total, couponCode }) {
  const res = await request(app)
    .post('/user/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId: address._id.toString(), ...razorpayBody(total), ...(couponCode ? { couponCode } : {}) });
  expect(res.status).toBe(201);
  return res.body.data;
}

const walletOf = async (userId) => (await Customer.findById(userId)).walletBalance;

describe('cancelling a single line', () => {
  it('admin sub-order cancel refunds that line, once, and restocks its variant', async () => {
    const { token: adminToken } = await createAdmin();
    const { vendor } = await createVendor();
    const product = await createProduct({
      price: 300,
      stock: 10,
      vendor: vendor._id,
      variants: [
        { name: 'Red', price: 300, stock: 4, isActive: true },
        { name: 'Blue', price: 300, stock: 4, isActive: true },
      ],
    });
    const { user, token, address } = await buyer();
    await addToCart(token, product._id, { variantId: String(product.variants[0]._id) });
    await addToCart(token, product._id, { variantId: String(product.variants[1]._id) });
    const order = await placePaidOrder({ token, address, total: 600 });

    const blueId = `${order.id}:${product._id}:${product.variants[1]._id}`;
    const cancel = () =>
      request(app)
        .post(`/admin/fulfilment/sub-orders/${blueId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Out of stock' });

    const [first, second] = await Promise.all([cancel(), cancel()]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);

    expect(await walletOf(user._id)).toBe(300);
    const fresh = await Order.findById(order.id);
    expect(fresh.items[1].status).toBe('CANCELLED');
    expect(fresh.items[0].status).toBe('PENDING');
    expect(fresh.refundedAmount).toBe(300);

    const stock = await Product.findById(product._id);
    expect(stock.variants[1].stock).toBe(4); // 4 - 1 reserved + 1 back
    expect(stock.variants[0].stock).toBe(3); // untouched
  });

  it('seller rejection refunds the buyer, and a later full cancel refunds only the rest', async () => {
    const { vendor, token: vendorToken } = await createVendor();
    const productA = await createProduct({ price: 500, stock: 5, vendor: vendor._id });
    const productB = await createProduct({ price: 200, stock: 5, vendor: vendor._id });
    const { user, token, address } = await buyer();
    await addToCart(token, productA._id);
    await addToCart(token, productB._id);
    const order = await placePaidOrder({ token, address, total: 700 });

    const reject = await request(app)
      .patch(`/vendor/orders/${order.id}/items/${productA._id}/status`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ status: 'CANCELLED', reason: 'Damaged in storage' });
    expect(reject.status).toBe(200);
    expect(await walletOf(user._id)).toBe(500);

    const cancel = await request(app).patch(`/user/orders/${order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);

    // 500 for the rejected line, then only the remaining 200 — not 700 again.
    expect(await walletOf(user._id)).toBe(700);
    // A's stock went back once (on rejection), not twice.
    expect((await Product.findById(productA._id)).stock).toBe(5);
    expect((await Product.findById(productB._id)).stock).toBe(5);
  });

  it('cancelling every line cancels the order', async () => {
    const { token: adminToken } = await createAdmin();
    const { vendor } = await createVendor();
    const product = await createProduct({ price: 250, stock: 5, vendor: vendor._id });
    const { user, token, address } = await buyer();
    await addToCart(token, product._id);
    const order = await placePaidOrder({ token, address, total: 250 });

    const res = await request(app)
      .post(`/admin/fulfilment/sub-orders/${order.id}:${product._id}:/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Seller unreachable' });
    expect(res.status).toBe(200);

    const fresh = await Order.findById(order.id);
    expect(fresh.status).toBe('CANCELLED');
    expect(fresh.paymentStatus).toBe('REFUNDED');
    expect(await walletOf(user._id)).toBe(250);
  });
});

describe('manual cancellation refund', () => {
  it('pays once however many times it is pressed', async () => {
    const { token: adminToken } = await createAdmin();
    const { user, token, address } = await buyer();
    const product = await createProduct({ price: 400, stock: 5 });
    await addToCart(token, product._id);
    const order = await placePaidOrder({ token, address, total: 400 });
    // A cancelled, paid, not-yet-refunded order.
    await Order.updateOne({ _id: order.id }, { $set: { status: 'CANCELLED' } });

    const press = () =>
      request(app).post(`/admin/fulfilment/cancellations/${order.id}/refund`).set('Authorization', `Bearer ${adminToken}`);
    await Promise.all([press(), press(), press()]);

    expect(await walletOf(user._id)).toBe(400);
    expect((await Order.findById(order.id)).paymentStatus).toBe('REFUNDED');
  });
});

describe('new-customer coupons', () => {
  it('are refused once the buyer has any live order, paid or not', async () => {
    const code = `NEW${unique().slice(-6)}`;
    await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 50,
      customerEligibility: 'NEW',
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const { token, address } = await buyer();
    const product = await createProduct({ price: 500, stock: 10 });

    // First order: COD, so still unpaid.
    await addToCart(token, product._id);
    const first = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', couponCode: code });
    expect(first.status).toBe(201);

    await addToCart(token, product._id);
    const second = await request(app)
      .post('/user/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'COD', couponCode: code });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/new customers/i);
  });
});

describe('delivery charges', () => {
  async function withCarrier({ freeShippingThreshold }) {
    await ShippingSettings.updateOne(
      { key: 'GLOBAL' },
      { $set: { shippingEnabled: true, freeShippingThreshold, defaultOriginPincode: '411002', policyVersion: 2 } }
    );
    jest.spyOn(serviceabilityService, 'checkLane').mockResolvedValue({
      ok: true,
      serviceable: true,
      couriers: [{ courierId: 1, courierName: 'Test', estimatedCost: 80, estimatedDeliveryDays: 3 }],
    });
    jest.spyOn(cjLogisticsService, 'calculateFreight').mockResolvedValue([
      { logisticName: 'CJPacket', logisticPrice: 2, logisticAging: '7-12' },
    ]);
  }
  afterEach(() =>
    ShippingSettings.updateOne({ key: 'GLOBAL' }, { $set: { shippingEnabled: false, freeShippingThreshold: 0 } })
  );

  it('judges free delivery on the amount after the coupon', async () => {
    await withCarrier({ freeShippingThreshold: 1000 });
    const code = `TEN${unique().slice(-6)}`;
    await Coupon.create({
      code,
      discountType: 'FIXED',
      discountValue: 100,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const { token, address } = await buyer();
    const product = await createProduct({ price: 1000, stock: 5 });
    await addToCart(token, product._id);

    const withoutCoupon = await request(app)
      .post('/user/orders/shipping-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'RAZORPAY' });
    expect(withoutCoupon.body.data.shippingFee).toBe(0);

    // ₹1000 - ₹100 = ₹900: below the threshold, so delivery is charged.
    const withCoupon = await request(app)
      .post('/user/orders/shipping-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'RAZORPAY', couponCode: code });
    expect(withCoupon.body.data.shippingFee).toBe(80);
  });

  it('never makes CJ freight free', async () => {
    await withCarrier({ freeShippingThreshold: 100 });
    const product = await createProduct({ price: 5000, stock: 5, vendor: null, fulfillmentProvider: 'CJ' });
    await ProductFulfillmentMapping.create({
      product: product._id,
      provider: 'CJ',
      cjProductId: `CJP${unique()}`,
      variants: [{ cjVariantId: `CJV${unique()}`, providerCost: 20 }],
    });
    const { token, address } = await buyer();
    await addToCart(token, product._id);

    const res = await request(app)
      .post('/user/orders/shipping-quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ addressId: address._id.toString(), paymentMethod: 'RAZORPAY' });
    expect(res.status).toBe(200);
    const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
    expect(res.body.data.shippingFee).toBeCloseTo(2 * USD_TO_INR_RATE, 2);
  });
});

describe('CJ variant names', () => {
  it('keeps only the words that tell variants apart', () => {
    expect(
      shortVariantLabels([
        'Hole-shaped Silicone Phone Storage Case White 16×10×3cm',
        'Hole-shaped Silicone Phone Storage Case Black 16×10×3cm',
        'Hole-shaped Silicone Phone Storage Case Rose Red 16×10×3cm',
      ])
    ).toEqual(['White', 'Black', 'Rose Red']);
  });

  it('leaves names alone when trimming would blank or duplicate one', () => {
    expect(shortVariantLabels(['Case', 'Case Pro'])).toEqual(['Case', 'Case Pro']);
    expect(shortVariantLabels(['Only One'])).toEqual(['Only One']);
  });
});
