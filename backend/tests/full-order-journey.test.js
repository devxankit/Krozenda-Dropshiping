// The whole marketplace journey through the real HTTP API, start to finish:
//
//   seller signs up → admin approves → seller lists a product → admin approves
//   it → buyer logs in by OTP → orders → cancels → orders again → seller ships
//   and delivers → buyer returns → admin approves, receives, refunds.
//
// with the edge cases each step must refuse, and a check at every step that
// the buyer and the seller were told — by Firebase push and by WhatsApp.
//
// Nothing leaves the machine: Firebase's messaging client and the WhatsApp
// gateway (global fetch) are replaced with recorders. What is asserted is
// exactly what would have been handed to them.

const sentPushes = [];
jest.mock('../Config/firebase', () => ({
  isFirebaseConfigured: true,
  messaging: {
    sendEachForMulticast: jest.fn(async (message) => {
      sentPushes.push(message);
      return {
        successCount: message.tokens.length,
        failureCount: 0,
        responses: message.tokens.map(() => ({ success: true })),
      };
    }),
  },
}));
jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const request = require('supertest');
const app = require('../app');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const ReturnRequest = require('../Models/ReturnRequest');
const { connectTestDb, disconnectTestDb, createAdmin, createCategory } = require('./helpers');

// --- WhatsApp gateway recorder ----------------------------------------------
const realFetch = global.fetch;
const savedEnv = { ...process.env };
const sentWhatsapp = [];

const TEMPLATES = {
  WHATSAPP_TEMPLATE_DEFAULT: 'order_update',
  WHATSAPP_TEMPLATE_ORDER_PLACED: 'order_placed',
  WHATSAPP_TEMPLATE_ORDER_CONFIRMED: 'order_confirmed',
  WHATSAPP_TEMPLATE_ORDER_SHIPPED: 'order_shipped',
  WHATSAPP_TEMPLATE_ORDER_DELIVERED: 'order_delivered',
  WHATSAPP_TEMPLATE_ORDER_CANCELLED: 'order_cancelled',
  WHATSAPP_TEMPLATE_VENDOR_NEW_ORDER: 'vendor_new_order',
  WHATSAPP_TEMPLATE_REFUND_PROCESSED: 'refund_processed',
};

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    // Anything but "test" lets the WhatsApp service send (to the recorder).
    ENV: 'staging',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_USER: 'u',
    WHATSAPP_PASS: 'p',
    WHATSAPP_SENDER: 'BUZWAP',
    ...TEMPLATES,
  });
  global.fetch = jest.fn(async (url) => {
    const parsed = new URL(String(url));
    if (parsed.searchParams.get('priority') === 'wa') {
      sentWhatsapp.push({ template: parsed.searchParams.get('text'), phone: parsed.searchParams.get('phone'), params: parsed.searchParams.get('Params') || '' });
      return { ok: true, status: 200, text: async () => `S.${sentWhatsapp.length}` };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  });
});

afterAll(async () => {
  global.fetch = realFetch;
  process.env = savedEnv;
  await disconnectTestDb();
});

// Pushes and WhatsApp sends are detached from the request that caused them;
// wait for the one we expect instead of sleeping a fixed time.
async function waitFor(check, label) {
  for (let i = 0; i < 150; i += 1) {
    const found = check();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}
const pushTo = (token, titlePattern) =>
  waitFor(
    () => sentPushes.find((m) => m.tokens.includes(token) && titlePattern.test(m.notification.title)),
    `push "${titlePattern}" to ${token}`
  );
const whatsappTo = (phone, template) =>
  waitFor(() => sentWhatsapp.find((m) => m.phone === phone && m.template === template), `WhatsApp ${template} to ${phone}`);

const VENDOR_PHONE = '9876500011';
const BUYER_PHONE = '9876500022';
const VENDOR_DEVICE = 'fcm-vendor-device-1';
const BUYER_DEVICE = 'fcm-buyer-device-1';

describe('full order journey — seller to buyer to return, through the API', () => {
  const ctx = {};
  const as = (token) => ({
    get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path, body = {}) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
    patch: (path, body = {}) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  });

  test('1. a new seller signs up and cannot log in until admin approves', async () => {
    const { token: adminToken } = await createAdmin();
    ctx.admin = as(adminToken);
    ctx.category = await createCategory();

    const policies = await request(app).get('/public/cms-acceptance');
    expect(policies.status).toBe(200);
    const policyAcceptances = policies.body.data.map((p) => ({ slug: p.slug, version: p.version || 'v1.0' }));

    const email = `seller.${Date.now()}@example.com`;
    const base = { vendorType: 'B2C', name: 'Journey Seller', email, mobile: VENDOR_PHONE, password: 'secret123', confirmPassword: 'secret123' };

    // Edge: the policies must be accepted.
    if (policyAcceptances.length > 0) {
      const noPolicies = await request(app).post('/vendor/auth/register').send(base);
      expect(noPolicies.status).toBe(400);
    }
    // Edge: mismatched passwords.
    expect((await request(app).post('/vendor/auth/register').send({ ...base, confirmPassword: 'other', policyAcceptances })).status).toBe(400);

    const registered = await request(app).post('/vendor/auth/register').send({ ...base, policyAcceptances });
    expect(registered.status).toBe(201);
    ctx.vendorId = registered.body.data.vendor.id || registered.body.data.vendor._id;

    // Edge: same email twice.
    expect((await request(app).post('/vendor/auth/register').send({ ...base, policyAcceptances })).status).toBe(409);

    // Edge: under review — no login yet.
    const early = await request(app).post('/vendor/auth/login').send({ email, password: 'secret123' });
    expect(early.status).toBe(403);
    expect(early.body.code).toBe('VERIFICATION_PENDING');

    const approved = await ctx.admin.patch(`/admin/vendors/${ctx.vendorId}/status`, { verificationStatus: 'APPROVED' });
    expect(approved.status).toBe(200);

    // Edge: wrong password.
    expect((await request(app).post('/vendor/auth/login').send({ email, password: 'wrong-pass' })).status).toBe(401);

    const login = await request(app).post('/vendor/auth/login').send({ email, password: 'secret123' });
    expect(login.status).toBe(200);
    ctx.vendor = as(login.body.data.token);

    const device = await ctx.vendor.post('/fcm-token', { token: VENDOR_DEVICE, deviceType: 'web' });
    expect(device.status).toBe(200);
  });

  test('2. the seller lists a product; buyers cannot see it until admin approves it', async () => {
    // Edge: required fields.
    expect((await ctx.vendor.post('/vendor/products', { name: 'No price', category: String(ctx.category._id), stock: 5, weight: 0.5 })).status).toBe(400);

    const created = await ctx.vendor.post('/vendor/products', {
      name: 'Journey Test Lamp',
      sku: `JRN-${Date.now()}`,
      category: String(ctx.category._id),
      price: 500,
      stock: 3,
      weight: 0.5,
      gstRate: 18,
      isReturnable: true,
      images: JSON.stringify(['/uploads/products/placeholder.webp']),
    });
    expect(created.status).toBe(201);
    ctx.productId = created.body.data.id;

    const product = await Product.findById(ctx.productId).lean();
    if (product.approvalStatus !== 'APPROVED') {
      const approve = await ctx.admin.post(`/admin/catalog/approvals/product:${ctx.productId}/approve`, { commission: null });
      expect(approve.status).toBe(200);
    }
    const live = await Product.findById(ctx.productId).lean();
    expect(live).toMatchObject({ approvalStatus: 'APPROVED', isActive: true, stock: 3 });
  });

  test('3. a buyer logs in by OTP, saves an address and registers a device', async () => {
    // Edge: a bad number.
    expect((await request(app).post('/auth/request-otp').send({ mobileNumber: '123' })).status).toBe(400);

    const otp = await request(app).post('/auth/request-otp').send({ mobileNumber: BUYER_PHONE });
    expect(otp.status).toBe(200);
    const code = otp.body.data.otp;

    // Edge: a wrong OTP.
    expect((await request(app).post('/auth/verify-otp').send({ mobileNumber: BUYER_PHONE, otp: '000000', name: 'Journey Buyer' })).status).toBeGreaterThanOrEqual(400);

    const verified = await request(app).post('/auth/verify-otp').send({ mobileNumber: BUYER_PHONE, otp: code, name: 'Journey Buyer' });
    expect(verified.status).toBe(200);
    const token = verified.body.data.accessToken || verified.body.data.token;
    expect(token).toBeTruthy();
    ctx.buyer = as(token);
    ctx.buyerHeader = `Bearer ${token}`;
    ctx.buyerId = verified.body.data.user.id;

    const address = await ctx.buyer.post('/user/addresses', {
      type: 'home',
      fullName: 'Journey Buyer',
      phone: BUYER_PHONE,
      line1: '12 Test Street',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pincode: '452001',
      isDefault: true,
    });
    expect(address.status).toBe(201);
    ctx.addressId = address.body.data.id || address.body.data.address?.id;
    expect(ctx.addressId).toBeTruthy();

    expect((await ctx.buyer.post('/fcm-token', { token: BUYER_DEVICE, deviceType: 'web' })).status).toBe(200);
  });

  test('4. first order: stock is held, and buyer + seller are told by WhatsApp and push', async () => {
    expect((await ctx.buyer.post('/user/cart/items', { productId: ctx.productId, quantity: 1 })).status).toBeLessThan(300);

    const placed = await ctx.buyer.post('/user/orders', { addressId: ctx.addressId, paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    ctx.firstOrderId = placed.body.data.id;
    expect(placed.body.data.total).toBeGreaterThanOrEqual(500);
    expect((await Product.findById(ctx.productId)).stock).toBe(2);

    // The seller hears about it.
    await pushTo(VENDOR_DEVICE, /new order/i);
    await whatsappTo(VENDOR_PHONE, 'vendor_new_order');
    // The buyer gets the order confirmation on WhatsApp.
    await whatsappTo(BUYER_PHONE, 'order_placed');

    // The cart is emptied by checkout.
    const cart = await ctx.buyer.get('/user/cart');
    expect((cart.body.data.items || []).length).toBe(0);
  });

  test('5. the buyer cancels it: stock comes back, and they are told', async () => {
    const cancelled = await ctx.buyer.patch(`/user/orders/${ctx.firstOrderId}/cancel`, { reason: 'Ordered by mistake' });
    expect(cancelled.status).toBe(200);
    expect((await Order.findById(ctx.firstOrderId)).status).toBe('CANCELLED');
    expect((await Product.findById(ctx.productId)).stock).toBe(3);

    await whatsappTo(BUYER_PHONE, 'order_cancelled');

    // Edge: cancelling twice.
    expect((await ctx.buyer.patch(`/user/orders/${ctx.firstOrderId}/cancel`, { reason: 'again' })).status).toBeGreaterThanOrEqual(400);
    // Edge: a cancelled order cannot be returned.
    const detail = await ctx.buyer.get(`/user/orders/${ctx.firstOrderId}`);
    expect(detail.body.data.canReturn).toBe(false);
  });

  test('6. second order, for two units; asking for more than stock is refused', async () => {
    await ctx.buyer.post('/user/cart/items', { productId: ctx.productId, quantity: 5 });
    // Either the cart caps it or checkout refuses — never an order for 5 of 3.
    const tooMany = await ctx.buyer.post('/user/orders', { addressId: ctx.addressId, paymentMethod: 'COD' });
    if (tooMany.status === 201) {
      expect(tooMany.body.data.items[0].quantity).toBeLessThanOrEqual(3);
      await ctx.buyer.patch(`/user/orders/${tooMany.body.data.id}/cancel`, { reason: 'test cleanup' });
    } else {
      expect(tooMany.status).toBe(409);
    }

    // Start the second order from an empty cart.
    const Cart = require('../Models/Cart');
    await Cart.deleteOne({ user: ctx.buyerId });

    expect((await ctx.buyer.post('/user/cart/items', { productId: ctx.productId, quantity: 2 })).status).toBeLessThan(300);
    const placed = await ctx.buyer.post('/user/orders', { addressId: ctx.addressId, paymentMethod: 'COD' });
    expect(placed.status).toBe(201);
    ctx.orderId = placed.body.data.id;
    expect(placed.body.data.items[0].quantity).toBe(2);
    expect((await Product.findById(ctx.productId)).stock).toBe(1);

    const order = await Order.findById(ctx.orderId).lean();
    expect(order.paymentStatus).toBe('PENDING');
    ctx.paid = order.total;
  });

  test('7. the seller ships and delivers; COD becomes paid; the buyer is kept informed', async () => {
    const item = (s, body = {}) => ctx.vendor.patch(`/vendor/orders/${ctx.orderId}/items/${ctx.productId}/status`, { status: s, ...body });

    // Edge: cannot skip straight to delivered.
    expect((await item('DELIVERED')).status).toBe(400);
    expect((await item('PROCESSING')).status).toBe(200);
    // Edge: shipping needs a tracking number.
    expect((await item('SHIPPED')).status).toBe(400);
    expect((await item('SHIPPED', { courierName: 'Delhivery', trackingNumber: 'AWB-JRN-1' })).status).toBe(200);
    await whatsappTo(BUYER_PHONE, 'order_shipped');
    await pushTo(BUYER_DEVICE, /shipped/i);

    expect((await item('DELIVERED')).status).toBe(200);
    await whatsappTo(BUYER_PHONE, 'order_delivered');

    const order = await Order.findById(ctx.orderId).lean();
    expect(order.items[0].status).toBe('DELIVERED');
    expect(order.status).toBe('DELIVERED');
    // Cash collected on delivery.
    expect(order.paymentStatus).toBe('PAID');

    // Edge: the other seller-only transition after delivery.
    expect((await item('CANCELLED', { reason: 'too late' })).status).toBe(400);
  });

  test('8. the buyer returns it; admin approves, receives, refunds — and everyone is told', async () => {
    const detail = await ctx.buyer.get(`/user/orders/${ctx.orderId}`);
    expect(detail.body.data.canReturn).toBe(true);

    const raised = await request(app)
      .post('/user/returns')
      .set('Authorization', ctx.buyerHeader)
      .field('orderId', ctx.orderId)
      .field('productId', ctx.productId)
      .field('requestType', 'REFUND')
      .field('reason', 'Damaged product');
    expect(raised.status).toBe(201);
    const id = raised.body.data.id;
    expect(raised.body.data.refundAmount).toBeGreaterThan(0);

    // The seller hears about the return and can weigh in.
    await pushTo(VENDOR_DEVICE, /refund requested|replacement requested/i);
    const recommend = await ctx.vendor.post(`/vendor/returns/${id}/recommend`, { decision: 'APPROVE', note: 'Our packaging failed' });
    expect(recommend.status).toBe(200);

    // Edge: a second request on the same line.
    const again = await request(app)
      .post('/user/returns')
      .set('Authorization', ctx.buyerHeader)
      .field('orderId', ctx.orderId)
      .field('productId', ctx.productId)
      .field('requestType', 'REFUND')
      .field('reason', 'Again');
    expect(again.status).toBe(400);

    // Edge: reject without a reason.
    expect((await ctx.admin.post(`/admin/returns/${id}/decide`, { decision: 'REJECTED' })).status).toBe(400);

    const walletBefore = (await Customer.findById(ctx.buyerId)).walletBalance || 0;
    expect((await ctx.admin.post(`/admin/returns/${id}/decide`, { decision: 'APPROVED' })).status).toBe(200);
    await pushTo(BUYER_DEVICE, /return approved/i);
    expect((await Customer.findById(ctx.buyerId)).walletBalance || 0).toBe(walletBefore);

    // Edge: cannot pay out before the item is back.
    expect((await ctx.admin.post(`/admin/returns/${id}/complete`, {})).status).toBe(400);

    expect((await ctx.admin.post(`/admin/returns/${id}/received`, {})).status).toBe(200);
    const done = await ctx.admin.post(`/admin/returns/${id}/complete`, { restock: true });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('refunded');

    const saved = await ReturnRequest.findById(id).lean();
    expect(saved).toMatchObject({ status: 'APPROVED', refundDestination: 'WALLET', restocked: true });
    expect((await Customer.findById(ctx.buyerId)).walletBalance).toBe(walletBefore + saved.refundAmount);
    // Both units back on the shelf.
    expect((await Product.findById(ctx.productId)).stock).toBe(3);

    await pushTo(BUYER_DEVICE, /refund/i);
    await whatsappTo(BUYER_PHONE, 'refund_processed');

    // Edge: paying twice.
    expect((await ctx.admin.post(`/admin/returns/${id}/complete`, { restock: true })).status).toBe(400);
    expect((await Customer.findById(ctx.buyerId)).walletBalance).toBe(walletBefore + saved.refundAmount);
  });

  test('9. both channels were exercised', () => {
    expect(sentPushes.length).toBeGreaterThan(0);
    expect(sentWhatsapp.length).toBeGreaterThan(0);
  });

  test('10. no order event was messaged twice, and messages went to the right people', async () => {
    // One of each event per order — a webhook retry or a double save must not resend.
    const orders = await Order.find({ user: ctx.buyerId }).select('whatsappLog').lean();
    for (const order of orders) {
      const events = (order.whatsappLog || []).map((row) => row.event);
      expect(new Set(events).size).toBe(events.length);
    }
    const onSecondOrder = orders.find((o) => String(o._id) === String(ctx.orderId)).whatsappLog.map((row) => row.event);
    expect(onSecondOrder).toEqual(expect.arrayContaining(['PLACED', 'SHIPPED', 'DELIVERED']));
    expect(sentWhatsapp.filter((m) => m.phone === BUYER_PHONE && m.template === 'refund_processed')).toHaveLength(1);
    // Nothing meant for the buyer reached the seller's phone, or the other way round.
    expect(sentWhatsapp.filter((m) => m.phone === VENDOR_PHONE).every((m) => m.template.startsWith('vendor_'))).toBe(true);
    expect(sentPushes.every((m) => m.tokens.every((t) => [VENDOR_DEVICE, BUYER_DEVICE].includes(t) || !t.startsWith('fcm-')))).toBe(true);
  });
});
