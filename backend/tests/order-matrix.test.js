// Every kind of order the marketplace takes, placed through the real API with
// the three outside services replaced by recorders — Shiprocket (seller and
// Krozenda stock), CJ Dropshipping (imported stock) and Razorpay (online pay).
//
//   who ships:  Krozenda stock · one seller · several sellers · CJ · mixed
//   how paid:   COD · Razorpay · wallet · with a coupon
//   what next:  delivered by webhook · buyer cancels · seller rejects a line ·
//               admin cancels a paid order · CJ tracking moves the order
//
// For each: the right carrier gets the right parcel with the right money on
// it, the order follows the parcel, and refunds land where they should.

jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const carrier = { orders: 0, calls: [] };
jest.mock('../services/shipping/shiprocketService', () => {
  const actual = jest.requireActual('../services/shipping/shiprocketService');
  const record = (name, answer) =>
    jest.fn(async (integration, payload) => {
      carrier.calls.push({ name, payload });
      return { status: 200, body: typeof answer === 'function' ? answer(payload) : answer };
    });
  return {
    ...actual,
    checkServiceability: record('checkServiceability', {
      data: {
        recommended_courier_company_id: 10,
        available_courier_companies: [
          { courier_company_id: 10, courier_name: 'Delhivery Surface', rate: 80, estimated_delivery_days: 4, etd: '2026-10-01', cod: 1 },
        ],
      },
    }),
    createOrder: record('createOrder', () => {
      carrier.orders += 1;
      return { order_id: 900000 + carrier.orders, shipment_id: 700000 + carrier.orders, status: 'NEW' };
    }),
    assignAWB: record('assignAWB', (payload) => ({
      awb_assign_status: 1,
      response: { data: { awb_code: `AWB${payload.shipmentId}`, courier_name: 'Delhivery Surface', courier_company_id: 10 } },
    })),
    cancelOrder: record('cancelOrder', { status: 200 }),
    cancelShipment: record('cancelShipment', { status: 200 }),
  };
});

// CJ: the HTTP client and its auth are replaced; the order, tracking and
// dropship services above them run for real.
const cj = { calls: [], orderStatus: 'UNPAID', track: null };
jest.mock('../services/cj/cjAuthService', () => ({
  withAuth: (fn) => fn('cj-test-token'),
  getAccessToken: async () => 'cj-test-token',
}));
jest.mock('../services/cj/cjClient', () => ({
  call: jest.fn(async (request) => {
    cj.calls.push(request);
    if (/freightCalculate/i.test(request.path)) {
      return { body: { data: [{ logisticName: 'CJPacket Ordinary', logisticPrice: 2 }] } };
    }
    if (/createOrder/i.test(request.path)) {
      return { body: { data: { orderId: `CJORD-${cj.calls.length}` } } };
    }
    if (/getOrderDetail/i.test(request.path)) {
      return { body: { data: { orderStatus: cj.orderStatus } } };
    }
    if (/track/i.test(request.path)) {
      return { body: { data: cj.track } };
    }
    return { body: { data: null } };
  }),
}));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const Customer = require('../Models/Customer');
const CjOrder = require('../Models/CjOrder');
const CjShipment = require('../Models/CjShipment');
const Shipment = require('../Models/Shipment');
const ShippingSettings = require('../Models/ShippingSettings');
const ShippingIntegration = require('../Models/ShippingIntegration');
const PickupLocation = require('../Models/PickupLocation');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const cjLogisticsService = require('../services/cj/cjLogisticsService');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
  createProduct,
  createAddress,
} = require('./helpers');

const WEBHOOK_TOKEN = 'matrix-webhook-token';
const savedEnv = { ...process.env };
let seq = 0;
const unique = () => `${Date.now()}${(seq += 1)}`;

async function pickupFor(vendorId, pincode) {
  return PickupLocation.create({
    vendor: vendorId,
    nickname: vendorId ? `WH-${unique()}` : 'Home',
    contactName: 'Warehouse',
    phone: '9999999999',
    addressLine1: 'Warehouse Road 1',
    city: 'Pune',
    state: 'Maharashtra',
    pincode,
    isDefault: true,
    registrationStatus: 'REGISTERED',
  });
}

const S = {};

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    SHIPROCKET_EMAIL: 'platform@krozenda.test',
    SHIPROCKET_PASSWORD: 'platform-secret',
    SHIPROCKET_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
  });
  await Promise.all([ShippingIntegration.deleteMany({}), PickupLocation.deleteMany({}), Shipment.deleteMany({})]);
  await ShippingSettings.updateOne(
    { key: 'GLOBAL' },
    {
      $set: {
        shippingEnabled: true,
        provider: 'SHIPROCKET',
        sellerOwnAccountEnabled: false,
        platformFallbackEnabled: true,
        codEnabled: true,
        defaultOriginPincode: '411002',
        freeShippingThreshold: 0,
      },
    },
    { upsert: true }
  );
  razorpay.payments.refund.mockResolvedValue({ id: 'rfnd_matrix' });

  await pickupFor(null, '411002');
  S.sellerA = (await createVendor()).vendor;
  S.sellerB = (await createVendor()).vendor;
  await pickupFor(S.sellerA._id, '411001');
  await pickupFor(S.sellerB._id, '400001');

  S.own = await createProduct({ name: 'Krozenda Lamp', price: 500, stock: 50, weight: 0.5 });
  S.a = await createProduct({ name: 'Seller A Mug', price: 300, stock: 50, weight: 0.4, vendor: S.sellerA._id });
  S.b = await createProduct({ name: 'Seller B Bag', price: 700, stock: 50, weight: 0.6, vendor: S.sellerB._id });

  S.cjProduct = await createProduct({
    name: 'CJ Import Watch',
    price: 900,
    stock: 20,
    vendor: null,
    fulfillmentProvider: 'CJ',
    variants: [{ name: 'Black', price: 900, stock: 20, isActive: true }],
  });
  await ProductFulfillmentMapping.create({
    product: S.cjProduct._id,
    provider: 'CJ',
    cjProductId: `CJP${unique()}`,
    variants: S.cjProduct.variants.map((v) => ({ krozendaVariantId: v._id, cjVariantId: `CJV-${unique()}`, providerCost: 4 })),
  });

  S.admin = (await createAdmin()).token;
});

afterAll(async () => {
  process.env = savedEnv;
  await disconnectTestDb();
});

afterEach(() => {
  razorpay.payments.fetch.mockReset();
});

// --- helpers -----------------------------------------------------------------

async function newBuyer({ wallet = 0 } = {}) {
  const { user, token } = await createCustomer();
  if (wallet) await Customer.updateOne({ _id: user._id }, { $set: { walletBalance: wallet } });
  const address = await createAddress(user._id, { phone: '9876512345', state: 'Madhya Pradesh', pincode: '452001' });
  return { user, token, address, auth: { Authorization: `Bearer ${token}` } };
}

async function addToCart(buyer, product, { quantity = 1, variantId } = {}) {
  const res = await request(app)
    .post('/user/cart/items')
    .set(buyer.auth)
    .send({ productId: String(product._id), quantity, ...(variantId ? { variantId: String(variantId) } : {}) });
  expect(res.status).toBeLessThan(300);
}

const quote = (buyer, paymentMethod, couponCode) =>
  request(app).post('/user/orders/shipping-quote').set(buyer.auth).send({ addressId: String(buyer.address._id), paymentMethod, couponCode });

function razorpayFields(total) {
  const razorpayOrderId = `order_${unique()}`;
  const razorpayPaymentId = `pay_${unique()}`;
  razorpay.payments.fetch.mockResolvedValue({ order_id: razorpayOrderId, status: 'captured', amount: Math.round(total * 100) });
  return {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex'),
  };
}

async function place(buyer, paymentMethod, { couponCode } = {}) {
  const q = await quote(buyer, paymentMethod, couponCode);
  expect(q.status).toBe(200);
  const body = { addressId: String(buyer.address._id), paymentMethod, ...(couponCode ? { couponCode } : {}) };
  if (paymentMethod === 'RAZORPAY') Object.assign(body, razorpayFields(q.body.data.total));
  const res = await request(app).post('/user/orders').set(buyer.auth).send(body);
  return { res, quote: q.body.data };
}

const webhook = (body) => request(app).post('/webhook').set('x-api-key', WEBHOOK_TOKEN).send(body);
const parcels = (orderId) => Shipment.find({ order: orderId, shipmentType: 'FORWARD' }).sort({ createdAt: 1 });
const createCalls = () => carrier.calls.filter((c) => c.name === 'createOrder');

async function deliver(shipment) {
  await shipment.constructor.updateOne({ _id: shipment._id }, { $set: { awbCode: `AWB-${shipment._id}` } });
  for (const [status, at] of [['PICKED UP', '2026-09-27 10:00:00'], ['IN TRANSIT', '2026-09-28 10:00:00'], ['DELIVERED', '2026-09-29 10:00:00']]) {
    const res = await webhook({ awb: `AWB-${shipment._id}`, current_status: status, current_timestamp: at });
    expect(res.status).toBe(200);
  }
}

// --- the matrix --------------------------------------------------------------

describe('order matrix', () => {
  test('Krozenda stock, COD: one parcel from the Krozenda warehouse; the courier collects the full total', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.own);
    const { res, quote: q } = await place(buyer, 'COD');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);

    const [parcel] = await parcels(order._id);
    expect(parcel.pickupLocationName).toBe('Home');
    expect(parcel.vendor).toBeNull();
    // Delivery charge included — the courier collects what the buyer owes.
    expect(parcel.collectableAmount).toBe(order.total);
    expect(order.total).toBe(q.total);
    const payload = createCalls().at(-1).payload;
    expect(payload.payment_method).toBe('COD');
    expect(payload.sub_total + payload.shipping_charges + payload.transaction_charges - payload.total_discount).toBeCloseTo(order.total, 2);

    await deliver(parcel);
    const done = await Order.findById(order._id);
    expect(done).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
  });

  test('one seller, Razorpay: a prepaid parcel from the seller; nothing to collect', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.a, { quantity: 2 });
    const { res } = await place(buyer, 'RAZORPAY');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);
    expect(order).toMatchObject({ paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' });

    const [parcel] = await parcels(order._id);
    expect(String(parcel.vendor)).toBe(String(S.sellerA._id));
    expect(parcel.collectableAmount).toBe(0);
    expect(createCalls().at(-1).payload.payment_method).toBe('Prepaid');

    await deliver(parcel);
    expect((await Order.findById(order._id)).status).toBe('DELIVERED');
  });

  test('wallet: paid from the wallet, shipped prepaid; a buyer without enough balance is refused', async () => {
    const poor = await newBuyer({ wallet: 10 });
    await addToCart(poor, S.a);
    const refused = await place(poor, 'WALLET');
    expect(refused.res.status).toBeGreaterThanOrEqual(400);

    const buyer = await newBuyer({ wallet: 5000 });
    await addToCart(buyer, S.a);
    const { res } = await place(buyer, 'WALLET');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);
    expect(order.paymentStatus).toBe('PAID');
    expect((await Customer.findById(buyer.user._id)).walletBalance).toBeCloseTo(5000 - order.total, 2);
    const [parcel] = await parcels(order._id);
    expect(parcel.collectableAmount).toBe(0);
  });

  test('several sellers + Krozenda stock, COD: one parcel per warehouse; together they collect exactly the order total', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.own);
    await addToCart(buyer, S.a);
    await addToCart(buyer, S.b);
    const { res } = await place(buyer, 'COD');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);

    const all = await parcels(order._id);
    expect(all).toHaveLength(3);
    expect(new Set(all.map((p) => p.pickupLocationName)).size).toBe(3);
    const collected = all.reduce((sum, p) => sum + Math.round(p.collectableAmount * 100), 0) / 100;
    expect(collected).toBeCloseTo(order.total, 2);

    // Two parcels arrive: the order is not delivered until the third does.
    await deliver(all[0]);
    await deliver(all[1]);
    expect((await Order.findById(order._id)).status).not.toBe('DELIVERED');
    await deliver(all[2]);
    expect((await Order.findById(order._id)).status).toBe('DELIVERED');
  });

  test('coupon: the discount comes off what the courier collects', async () => {
    const code = `MX${unique()}`.slice(0, 12).toUpperCase();
    await Coupon.create({
      code,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    const buyer = await newBuyer();
    await addToCart(buyer, S.b);
    const { res } = await place(buyer, 'COD', { couponCode: code });
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);
    expect(order.discountAmount).toBe(70);

    const [parcel] = await parcels(order._id);
    expect(parcel.collectableAmount).toBe(order.total);
    expect(createCalls().at(-1).payload.total_discount).toBe(70);
  });

  test('seller rejects their line on a multi-seller prepaid order: that parcel is cancelled at Shiprocket, the line refunded, the rest untouched', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.a);
    await addToCart(buyer, S.b);
    const { res } = await place(buyer, 'RAZORPAY');
    expect(res.status).toBe(201);
    const orderId = res.body.data.id;
    const all = await parcels(orderId);
    const parcelA = all.find((p) => String(p.vendor) === String(S.sellerA._id));
    const parcelB = all.find((p) => String(p.vendor) === String(S.sellerB._id));

    const { signToken } = require('../utils/jwt');
    const sellerToken = signToken('vendor', { id: String(S.sellerA._id), vendorType: S.sellerA.vendorType });
    const walletBefore = (await Customer.findById(buyer.user._id)).walletBalance || 0;
    const rejected = await request(app)
      .patch(`/vendor/orders/${orderId}/items/${S.a._id}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'CANCELLED', reason: 'Out of stock at my warehouse' });
    expect(rejected.status).toBe(200);

    expect((await Shipment.findById(parcelA._id)).internalStatus).toBe('CANCEL_REQUESTED');
    expect((await Shipment.findById(parcelB._id)).internalStatus).toBe('SHIPMENT_CREATED');
    expect((await Customer.findById(buyer.user._id)).walletBalance).toBeCloseTo(walletBefore + 300, 2);
    const order = await Order.findById(orderId);
    expect(order.status).not.toBe('CANCELLED');
    expect(order.items.find((i) => String(i.product) === String(S.a._id)).status).toBe('CANCELLED');
  });

  test('admin cancels a paid order: the buyer is refunded and the parcel is cancelled at Shiprocket', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.own);
    const { res } = await place(buyer, 'RAZORPAY');
    const orderId = res.body.data.id;
    const [parcel] = await parcels(orderId);

    const walletBefore = (await Customer.findById(buyer.user._id)).walletBalance || 0;
    const cancelled = await request(app)
      .patch(`/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${S.admin}`)
      .send({ status: 'CANCELLED' });
    expect(cancelled.status).toBe(200);
    const order = await Order.findById(orderId);
    expect(order.status).toBe('CANCELLED');
    expect(order.items.every((i) => i.status === 'CANCELLED')).toBe(true);
    expect((await Customer.findById(buyer.user._id)).walletBalance).toBeCloseTo(walletBefore + order.total, 2);
    expect((await Shipment.findById(parcel._id)).internalStatus).toBe('CANCEL_REQUESTED');
  });

  test('CJ dropship: online only, ordered at CJ, and CJ tracking moves the buyer’s order to delivered', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.cjProduct, { variantId: S.cjProduct.variants[0]._id });

    // COD and wallet are not offered.
    const cod = await place(buyer, 'COD');
    expect(cod.res.status).toBe(409);

    const before = carrier.calls.length;
    const { res } = await place(buyer, 'RAZORPAY');
    expect(res.status).toBe(201);
    const order = await Order.findById(res.body.data.id);
    expect(order.fulfillmentType).toBe('DROPSHIP');
    // Not sent to Shiprocket — CJ ships it.
    expect(carrier.calls.slice(before).some((c) => c.name === 'createOrder')).toBe(false);

    const cjOrder = await CjOrder.findOne({ krozendaOrderId: order._id });
    expect(cjOrder.cjOrderId).toMatch(/^CJORD-/);
    const createCall = cj.calls.find((c) => /createOrder/i.test(c.path));
    expect(createCall.body).toMatchObject({ shippingZip: '452001', shippingCountryCode: 'IN' });
    // A tracking row exists from the start, so the poller follows it.
    const tracking = await CjShipment.findOne({ cjOrder: cjOrder._id });
    expect(tracking).toBeTruthy();

    // The buyer can neither cancel nor return it.
    const cancel = await request(app).patch(`/user/orders/${order._id}/cancel`).set(buyer.auth).send({});
    expect(cancel.status).toBe(403);

    // CJ tracking, as the poller or webhook fetches it.
    cj.track = { trackingNumber: 'CJTRK123', logisticName: 'CJPacket Ordinary', trackStatus: 'IN_TRANSIT', trackInfoList: [] };
    await cjLogisticsService.syncShipment(await CjShipment.findById(tracking._id));
    let now = await Order.findById(order._id);
    expect(now.items[0]).toMatchObject({ status: 'SHIPPED', trackingNumber: 'CJTRK123' });
    expect(now.status).toBe('SHIPPED');

    cj.track = { ...cj.track, trackStatus: 'DELIVERED' };
    await cjLogisticsService.syncShipment(await CjShipment.findById(tracking._id));
    now = await Order.findById(order._id);
    expect(now.status).toBe('DELIVERED');

    const detail = await request(app).get(`/user/orders/${order._id}`).set(buyer.auth);
    expect(detail.body.data.canReturn).toBe(false);
  });

  test('mixed cart (seller + CJ): two orders on one payment — the seller part to Shiprocket, the CJ part to CJ', async () => {
    const buyer = await newBuyer();
    await addToCart(buyer, S.a);
    await addToCart(buyer, S.cjProduct, { variantId: S.cjProduct.variants[0]._id });
    const { res, quote: q } = await place(buyer, 'RAZORPAY');
    expect(res.status).toBe(201);

    const orders = await Order.find({ user: buyer.user._id }).sort({ checkoutGroupIndex: 1 });
    expect(orders.map((o) => o.fulfillmentType).sort()).toEqual(['DROPSHIP', 'STANDARD']);
    const sum = orders.reduce((acc, o) => acc + Math.round(o.total * 100), 0) / 100;
    expect(sum).toBeCloseTo(q.total, 2);

    const standard = orders.find((o) => o.fulfillmentType === 'STANDARD');
    const dropship = orders.find((o) => o.fulfillmentType === 'DROPSHIP');
    expect(await parcels(standard._id)).toHaveLength(1);
    expect(await parcels(dropship._id)).toHaveLength(0);
    expect(await CjOrder.exists({ krozendaOrderId: dropship._id })).toBeTruthy();
  });
});
