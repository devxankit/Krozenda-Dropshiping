// Orders reaching Shiprocket, end to end, with the carrier replaced by a
// recorder: every call we would make to Shiprocket is captured and answered
// the way Shiprocket answers, and Shiprocket's webhooks are replayed into our
// real /webhook endpoint.
//
//   order placed → parcel created at Shiprocket → AWB → pickup → webhook scans
//   (picked up, in transit, out for delivery, delivered) → order DELIVERED,
//   COD paid; buyer cancels → parcel cancelled at Shiprocket; return approved →
//   reverse pickup booked → return delivered → return received → refunded.

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
    schedulePickup: record('schedulePickup', { pickup_status: 1, response: { pickup_scheduled_date: '2026-09-27 10:00:00' } }),
    // Shiprocket confirms a pre-AWB cancel when asked.
    getOrder: record('getOrder', { data: { status: 'CANCELED' } }),
    cancelOrder: record('cancelOrder', { status: 200, message: 'Order cancelled' }),
    cancelShipment: record('cancelShipment', { status: 200, message: 'Shipment cancelled' }),
    createReturn: record('createReturn', () => ({ order_id: 950001, shipment_id: 850001, status: 'RETURN PENDING' })),
  };
});

const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const Shipment = require('../Models/Shipment');
const ShippingSettings = require('../Models/ShippingSettings');
const ShippingIntegration = require('../Models/ShippingIntegration');
const PickupLocation = require('../Models/PickupLocation');
const ReturnRequest = require('../Models/ReturnRequest');
const NotificationDispatch = require('../Models/NotificationDispatch');
const Notification = require('../Models/Notification');
const Customer = require('../Models/Customer');
const shipmentService = require('../services/shipping/shipmentService');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
  createProduct,
  createAddress,
} = require('./helpers');

const WEBHOOK_TOKEN = 'test-webhook-token';
const savedEnv = { ...process.env };

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    SHIPROCKET_EMAIL: 'platform@krozenda.test',
    SHIPROCKET_PASSWORD: 'platform-secret',
    SHIPROCKET_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
  });
  await Promise.all([ShippingIntegration.deleteMany({}), PickupLocation.deleteMany({}), Shipment.deleteMany({})]);
  // Live-like: shipping on, the admin's Shiprocket account ships everything.
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
  // Krozenda's own warehouse, registered at Shiprocket.
  await PickupLocation.create({
    vendor: null,
    nickname: 'Home',
    contactName: 'Krozenda Warehouse',
    phone: '9999999999',
    addressLine1: 'Warehouse Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411002',
    isDefault: true,
    registrationStatus: 'REGISTERED',
  });
});

afterAll(async () => {
  process.env = savedEnv;
  await disconnectTestDb();
});

const calls = (name) => carrier.calls.filter((c) => c.name === name);

async function buyerOrder(product, quantity = 1) {
  const { user, token } = await createCustomer();
  const address = await createAddress(user._id, { phone: '9876512345', state: 'Madhya Pradesh', pincode: '452001' });
  await request(app).post('/user/cart/items').set('Authorization', `Bearer ${token}`).send({ productId: String(product._id), quantity });
  const placed = await request(app)
    .post('/user/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId: String(address._id), paymentMethod: 'COD' });
  expect(placed.status).toBe(201);
  return { user, token, orderId: placed.body.data.id };
}

function webhook(body, token = WEBHOOK_TOKEN) {
  return request(app).post('/webhook').set('x-api-key', token).send(body);
}

describe('Shiprocket order flow', () => {
  const ctx = {};

  test('a Krozenda-stock order is created at Shiprocket the moment it is placed', async () => {
    ctx.product = await createProduct({ price: 600, stock: 10, weight: 0.4, isReturnable: true });
    const before = calls('createOrder').length;
    Object.assign(ctx, await buyerOrder(ctx.product));

    expect(calls('createOrder')).toHaveLength(before + 1);
    const payload = calls('createOrder').at(-1).payload;
    expect(payload).toMatchObject({ pickup_location: 'Home', payment_method: 'COD', shipping_is_billing: true });
    expect(String(payload.billing_pincode)).toBe('452001');
    expect(payload.order_items[0]).toMatchObject({ units: 1 });

    const shipment = await Shipment.findOne({ order: ctx.orderId, shipmentType: 'FORWARD' });
    expect(shipment).toBeTruthy();
    expect(shipment.internalStatus).toBe('SHIPMENT_CREATED');
    expect(shipment.shiprocketShipmentId).toBeTruthy();
    ctx.shipmentId = shipment._id;
  });

  test('AWB and pickup are booked, and the AWB reaches the order line', async () => {
    const awb = await shipmentService.assignAwb({ shipmentId: String(ctx.shipmentId), actor: 'ADMIN' });
    expect(awb.ok).toBe(true);
    const pickup = await shipmentService.schedulePickup({ shipmentId: String(ctx.shipmentId), actor: 'ADMIN' });
    expect(pickup.ok).toBe(true);

    const shipment = await Shipment.findById(ctx.shipmentId);
    expect(shipment.internalStatus).toBe('PICKUP_SCHEDULED');
    ctx.awb = shipment.awbCode;
    expect(ctx.awb).toBeTruthy();

    const order = await Order.findById(ctx.orderId);
    expect(order.items[0].trackingNumber).toBe(ctx.awb);
    expect(order.items[0].courierName).toBe('Delhivery Surface');
  });

  test('AWB: when Shiprocket refuses the chosen courier, the next option is tried', async () => {
    const shiprocketService = require('../services/shipping/shiprocketService');
    const product = await createProduct({ price: 240, stock: 5, weight: 0.3 });
    const { orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });

    shiprocketService.assignAWB.mockResolvedValueOnce({
      status: 200,
      body: { awb_assign_status: 0, response: { data: { awb_assign_error: 'Selected courier not available between 411002 and 452001' } } },
    });
    const before = shiprocketService.assignAWB.mock.calls.length;
    const result = await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    expect(result.ok).toBe(true);
    expect((await Shipment.findById(shipment._id)).awbCode).toBeTruthy();
    // jest's own call log: a mockResolvedValueOnce answer skips the recorder.
    const tried = shiprocketService.assignAWB.mock.calls.slice(before).map(([, payload]) => payload.courierId);
    expect(tried).toEqual([10, null]);
  });

  test('AWB: Shiprocket refuses the courier but assigns its own — that AWB is adopted', async () => {
    const shiprocketService = require('../services/shipping/shiprocketService');
    const product = await createProduct({ price: 255, stock: 5, weight: 0.3 });
    const { orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });

    // As seen live: "not available", and on asking again "already assigned".
    shiprocketService.assignAWB
      .mockResolvedValueOnce({ status: 200, body: { awb_assign_status: 0, response: { data: { awb_assign_error: 'Selected courier not available between 411002 and 452010' } } } })
      .mockResolvedValueOnce({ status: 200, body: { awb_assign_status: 0, response: { data: { awb_assign_error: 'AWB is already assigned with awb - 1091403258165 and status - AWB ASSIGNED' } } } });
    shiprocketService.getOrder
      .mockResolvedValueOnce({ status: 200, body: { data: { status: 'NEW', shipments: {} } } })
      .mockResolvedValueOnce({ status: 200, body: { data: { status: 'AWB ASSIGNED', shipments: { awb: '1091403258165', courier: 'Xpressbees Surface' } } } });

    const result = await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    expect(result.ok).toBe(true);
    const fresh = await Shipment.findById(shipment._id);
    expect(fresh.awbCode).toBe('1091403258165');
    expect(fresh.courierName).toBe('Xpressbees Surface');
    expect(fresh.internalStatus).toBe('AWB_ASSIGNED');
  });

  test('AWB: a refusal that another courier cannot fix (wallet) is shown with its reason', async () => {
    const shiprocketService = require('../services/shipping/shiprocketService');
    const product = await createProduct({ price: 245, stock: 5, weight: 0.3 });
    const { orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });

    shiprocketService.assignAWB.mockResolvedValueOnce({
      status: 200,
      body: { awb_assign_status: 0, response: { data: { awb_assign_error: 'Insufficient wallet balance' } } },
    });
    const before = shiprocketService.assignAWB.mock.calls.length;
    const result = await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Insufficient wallet balance/);
    // Another courier cannot fix a wallet problem: tried once.
    expect(shiprocketService.assignAWB.mock.calls.length - before).toBe(1);
  });

  test('"Already in Pickup Queue" from Shiprocket counts as scheduled, not an error', async () => {
    const product = await createProduct({ price: 250, stock: 5, weight: 0.3 });
    const { orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });
    expect((await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' })).ok).toBe(true);

    const shiprocketService = require('../services/shipping/shiprocketService');
    const { ShiprocketError } = require('../services/shipping/shiprocketClient');
    shiprocketService.schedulePickup.mockRejectedValueOnce(
      new ShiprocketError('Already in Pickup Queue.', { status: 400, code: 'SHIPROCKET_VALIDATION', body: { message: 'Already in Pickup Queue.' } })
    );
    const result = await shipmentService.schedulePickup({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    expect(result.ok).toBe(true);
    const fresh = await Shipment.findById(shipment._id);
    expect(fresh.internalStatus).toBe('PICKUP_SCHEDULED');
    expect(fresh.pickupScheduledAt).toBeTruthy();
    expect(fresh.errorMessage).toBe('');
  });

  test('webhooks walk the order to DELIVERED; COD becomes paid', async () => {
    // A forged webhook is refused.
    expect((await webhook({ awb: ctx.awb, current_status: 'DELIVERED' }, 'wrong-token')).status).toBe(401);

    expect((await webhook({ awb: ctx.awb, current_status: 'PICKED UP', current_timestamp: '2026-09-27 12:00:00' })).status).toBe(200);
    let order = await Order.findById(ctx.orderId);
    expect(order.items[0].status).toBe('SHIPPED');
    expect(order.status).toBe('SHIPPED');

    await webhook({ awb: ctx.awb, current_status: 'IN TRANSIT', current_timestamp: '2026-09-28 09:00:00' });
    await webhook({ awb: ctx.awb, current_status: 'OUT FOR DELIVERY', current_timestamp: '2026-09-29 08:00:00' });
    expect((await Shipment.findById(ctx.shipmentId)).internalStatus).toBe('OUT_FOR_DELIVERY');

    await webhook({ awb: ctx.awb, current_status: 'DELIVERED', current_timestamp: '2026-09-29 14:00:00' });
    order = await Order.findById(ctx.orderId);
    expect(order.items[0].status).toBe('DELIVERED');
    expect(order.status).toBe('DELIVERED');
    expect(order.paymentStatus).toBe('PAID');
    expect((await Shipment.findById(ctx.shipmentId)).internalStatus).toBe('DELIVERED');

    // A duplicate and a late out-of-order scan change nothing.
    await webhook({ awb: ctx.awb, current_status: 'DELIVERED', current_timestamp: '2026-09-29 14:00:00' });
    await webhook({ awb: ctx.awb, current_status: 'IN TRANSIT', current_timestamp: '2026-09-28 09:00:00' });
    expect((await Shipment.findById(ctx.shipmentId)).internalStatus).toBe('DELIVERED');
    expect((await Order.findById(ctx.orderId)).status).toBe('DELIVERED');

    // An unknown AWB is acknowledged, not an error (Shiprocket would retry).
    expect((await webhook({ awb: 'NOT-OURS', current_status: 'DELIVERED' })).status).toBe(200);
  });

  test('RTO: a parcel the courier brings back sits in the RTO tab and is restocked once', async () => {
    const Product = require('../Models/Product');
    const product = await createProduct({ price: 350, stock: 10, weight: 0.3 });
    const { orderId } = await buyerOrder(product);
    expect((await Product.findById(product._id)).stock).toBe(9);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });
    await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    const awb = (await Shipment.findById(shipment._id)).awbCode;

    await webhook({ awb, current_status: 'PICKED UP', current_timestamp: '2026-09-27 10:00:00' });
    await webhook({ awb, current_status: 'RTO INITIATED', current_timestamp: '2026-09-28 10:00:00' });
    // Not back yet: restocking now would put stock on sale that is still on a truck.
    expect((await shipmentService.restockRto({ shipmentId: String(shipment._id) })).ok).toBe(false);
    await webhook({ awb, current_status: 'RTO DELIVERED', current_timestamp: '2026-09-30 10:00:00' });
    expect((await Shipment.findById(shipment._id)).internalStatus).toBe('RTO_DELIVERED');

    const { token: adminToken } = await createAdmin();
    const rtoTab = await request(app).get('/admin/shipping/shipments?group=RTO').set('Authorization', `Bearer ${adminToken}`);
    expect(rtoTab.status).toBe(200);
    expect(rtoTab.body.data.items.some((row) => row.id === String(shipment._id))).toBe(true);
    expect(rtoTab.body.data.groupCounts.RTO).toBeGreaterThanOrEqual(1);

    const restock = await request(app).post(`/admin/shipping/shipments/${shipment._id}/restock`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(restock.status).toBe(200);
    expect((await Product.findById(product._id)).stock).toBe(10);
    // Twice is refused; stock does not double.
    const again = await request(app).post(`/admin/shipping/shipments/${shipment._id}/restock`).set('Authorization', `Bearer ${adminToken}`).send({});
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect((await Product.findById(product._id)).stock).toBe(10);
    expect(await NotificationDispatch.exists({ key: `ADMIN:RTO_DELIVERED:${shipment._id}` })).toBeTruthy();
  });

  test('a cancelled order has its Shiprocket parcel cancelled too', async () => {
    const product = await createProduct({ price: 300, stock: 5, weight: 0.3 });
    const { token, orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });
    expect(shipment.internalStatus).toBe('SHIPMENT_CREATED');

    const before = calls('cancelOrder').length;
    const res = await request(app).patch(`/user/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`).send({ reason: 'Changed mind' });
    expect(res.status).toBe(200);

    // The line is cancelled with the order, so no panel shows it as live.
    expect((await Order.findById(orderId)).items.every((i) => i.status === 'CANCELLED')).toBe(true);
    expect(calls('cancelOrder')).toHaveLength(before + 1);
    expect(calls('cancelOrder').at(-1).payload.orderIds).toEqual([shipment.shiprocketOrderId]);
    // Before an AWB there is no webhook to wait for: Shiprocket is asked
    // straight away and confirms it.
    expect((await Shipment.findById(shipment._id)).internalStatus).toBe('CANCELLED');
    // A late webhook changes nothing; the order stays cancelled.
    await webhook({ shipment_id: shipment.shiprocketShipmentId, current_status: 'CANCELED' });
    expect((await Shipment.findById(shipment._id)).internalStatus).toBe('CANCELLED');
    expect((await Order.findById(orderId)).status).toBe('CANCELLED');
  });

  test('cancelling after an AWB cancels the AWB AND the order at Shiprocket', async () => {
    const product = await createProduct({ price: 330, stock: 5, weight: 0.3 });
    const { token, orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });
    await shipmentService.assignAwb({ shipmentId: String(shipment._id), actor: 'ADMIN' });
    const awb = (await Shipment.findById(shipment._id)).awbCode;

    const awbBefore = calls('cancelShipment').length;
    const orderBefore = calls('cancelOrder').length;
    await request(app).patch(`/user/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`).send({});

    // The AWB cancel alone leaves the Shiprocket order NEW (seen live).
    expect(calls('cancelShipment').slice(awbBefore).map((c) => c.payload.awbs)).toEqual([[awb]]);
    expect(calls('cancelOrder').slice(orderBefore).map((c) => c.payload.orderIds)).toEqual([[shipment.shiprocketOrderId]]);
    expect((await Shipment.findById(shipment._id)).internalStatus).toBe('CANCELLED');
  });

  test('a cancel Shiprocket accepts but does not apply is retried, then flagged for a human', async () => {
    const shiprocketService = require('../services/shipping/shiprocketService');
    const product = await createProduct({ price: 310, stock: 5, weight: 0.3 });
    const { token, orderId } = await buyerOrder(product);
    const shipment = await Shipment.findOne({ order: orderId, shipmentType: 'FORWARD' });

    // Still NEW after the cancel, and after the retry.
    shiprocketService.getOrder
      .mockResolvedValueOnce({ status: 200, body: { data: { status: 'NEW' } } })
      .mockResolvedValueOnce({ status: 200, body: { data: { status: 'NEW' } } });
    const before = calls('cancelOrder').length;
    await request(app).patch(`/user/orders/${orderId}/cancel`).set('Authorization', `Bearer ${token}`).send({});

    expect(calls('cancelOrder')).toHaveLength(before + 2);
    const fresh = await Shipment.findById(shipment._id);
    expect(fresh.internalStatus).toBe('CANCEL_REQUESTED');
    expect(fresh.errorMessage).toMatch(/still shows the order as open/);
    expect(await NotificationDispatch.exists({ key: `ADMIN:SHIPMENT_CANCEL_UNCONFIRMED:${shipment._id}` })).toBeTruthy();
    expect((await Order.findById(orderId)).status).toBe('CANCELLED');
  });

  test('a seller with no pickup address: nothing reaches Shiprocket, and admin + seller are told', async () => {
    const { vendor } = await createVendor();
    const product = await createProduct({ price: 450, stock: 5, weight: 0.3, vendor: vendor._id });
    const before = calls('createOrder').length;
    const { orderId } = await buyerOrder(product);

    expect(calls('createOrder')).toHaveLength(before);
    expect(await Shipment.exists({ order: orderId })).toBeNull();
    expect(await NotificationDispatch.exists({ key: new RegExp(`AUTO_SHIPMENT_FAILED:${orderId}`) })).toBeTruthy();
    expect(await Notification.exists({ vendor: vendor._id, title: /pickup address/i })).toBeTruthy();
  });

  test('a return books a reverse pickup at Shiprocket; its delivery marks the return received', async () => {
    const raised = await request(app)
      .post('/user/returns')
      .set('Authorization', `Bearer ${ctx.token}`)
      .field('orderId', ctx.orderId)
      .field('productId', String(ctx.product._id))
      .field('requestType', 'REFUND')
      .field('reason', 'Damaged product');
    expect(raised.status).toBe(201);
    const id = raised.body.data.id;

    const { token: adminToken } = await createAdmin();
    const before = calls('createReturn').length;
    const approved = await request(app)
      .post(`/admin/returns/${id}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVED' });
    expect(approved.status).toBe(200);

    expect(calls('createReturn')).toHaveLength(before + 1);
    const returnPayload = calls('createReturn').at(-1).payload;
    // Pickup from the buyer, delivery to the warehouse.
    expect(String(returnPayload.pickup_pincode)).toBe('452001');
    expect(String(returnPayload.shipping_pincode)).toBe('411002');

    const request1 = await ReturnRequest.findById(id);
    expect(request1.pickupMode).toBe('COURIER');
    const reverse = await Shipment.findById(request1.returnShipment);
    expect(reverse).toMatchObject({ shipmentType: 'RETURN', internalStatus: 'RETURN_REQUESTED' });

    // Shiprocket reports the reverse parcel with the ordinary forward words.
    await webhook({ shipment_id: reverse.shiprocketShipmentId, current_status: 'PICKED UP', current_timestamp: '2026-09-30 10:00:00' });
    expect((await Shipment.findById(reverse._id)).internalStatus).toBe('RETURN_IN_TRANSIT');
    await webhook({ shipment_id: reverse.shiprocketShipmentId, current_status: 'DELIVERED', current_timestamp: '2026-10-01 10:00:00' });
    expect((await Shipment.findById(reverse._id)).internalStatus).toBe('RETURN_DELIVERED');

    // The Shipment hook marks it received (detached — give it a moment).
    let received = null;
    for (let i = 0; i < 50 && !received; i += 1) {
      received = (await ReturnRequest.findById(id)).itemReceivedAt;
      if (!received) await new Promise((r) => setTimeout(r, 20));
    }
    expect(received).toBeTruthy();

    // The delivered order line keeps its outbound AWB and DELIVERED status.
    const order = await Order.findById(ctx.orderId);
    expect(order.items[0]).toMatchObject({ status: 'DELIVERED', trackingNumber: ctx.awb });

    const walletBefore = (await Customer.findById(ctx.user._id)).walletBalance || 0;
    const done = await request(app)
      .post(`/admin/returns/${id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ restock: true });
    expect(done.status).toBe(200);
    expect((await Customer.findById(ctx.user._id)).walletBalance).toBe(walletBefore + request1.refundAmount);
  });

  test('delete: only a cancelled, never-paid order; its parcel goes too; only a super admin', async () => {
    const { token: adminToken } = await createAdmin();
    const del = (path, token = adminToken) => request(app).delete(path).set('Authorization', `Bearer ${token}`);

    // A live order cannot be deleted.
    const product = await createProduct({ price: 220, stock: 10, weight: 0.3 });
    const live = await buyerOrder(product);
    const liveShipment = await Shipment.findOne({ order: live.orderId });
    expect((await del(`/admin/orders/${live.orderId}`)).status).toBe(409);
    // Nor its parcel while it is open at Shiprocket.
    expect((await del(`/admin/shipping/shipments/${liveShipment._id}`)).status).toBe(409);

    // Cancelled COD order: deleted, with its parcel and notifications.
    await request(app).patch(`/user/orders/${live.orderId}/cancel`).set('Authorization', `Bearer ${live.token}`).send({});
    const staff = await createAdmin({ role: 'staff' });
    expect((await del(`/admin/orders/${live.orderId}`, staff.token)).status).toBe(403);
    const gone = await del(`/admin/orders/${live.orderId}`);
    expect(gone.status).toBe(200);
    expect(await Order.exists({ _id: live.orderId })).toBeNull();
    expect(await Shipment.exists({ order: live.orderId })).toBeNull();

    // A cancelled order that was paid and refunded is kept for the accounts.
    const paid = await buyerOrder(product);
    await Order.updateOne({ _id: paid.orderId }, { $set: { status: 'CANCELLED', paymentStatus: 'REFUNDED', paymentMethod: 'RAZORPAY' } });
    const refused = await del(`/admin/orders/${paid.orderId}`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('MONEY_MOVED');
    expect(await Order.exists({ _id: paid.orderId })).toBeTruthy();

    // A delivered order is kept.
    expect((await del(`/admin/orders/${ctx.orderId}`)).status).toBe(409);
  });
});
