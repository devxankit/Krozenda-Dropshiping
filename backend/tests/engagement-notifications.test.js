const Order = require('../Models/Order');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const Product = require('../Models/Product');
const Notification = require('../Models/Notification');
const CheckoutAttempt = require('../Models/CheckoutAttempt');
const NotificationDispatch = require('../Models/NotificationDispatch');
const whatsapp = require('../services/whatsappService');
const { alertAdmins } = require('../services/adminAlertService');
const vendorAlerts = require('../services/vendorAlertService');
const { allowsPush } = require('../Controllers/notificationController');
const { notifyCjShipmentMilestone } = require('../services/buyerAlertService');
const { mapTrackingStatus } = require('../services/cj/cjLogisticsService');
const CjShipment = require('../Models/CjShipment');
const job = require('../Jobs/engagementJob');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createVendor,
  createCategory,
  createProduct,
} = require('./helpers');

// The gateway is never reached: fetch is replaced for the whole file, and ENV
// is switched away from 'test' only so the service agrees to "send".
const realFetch = global.fetch;
const savedEnv = { ...process.env };
let sent;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    ENV: 'production',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_USER: 'u',
    WHATSAPP_PASS: 'p',
    WHATSAPP_SENDER: 'BUZWAP',
    // No order-status templates: only the templates under test ever send.
    WHATSAPP_TEMPLATE_DEFAULT: '',
    // Stands in for "not approved yet", whatever the real .env has.
    WHATSAPP_TEMPLATE_VENDOR_SETTLEMENT: '',
    WHATSAPP_TEMPLATE_VENDOR_NEW_ORDER: 'vendor_new_order',
    WHATSAPP_TEMPLATE_PAYMENT_PENDING: 'payment_pending',
    WHATSAPP_TEMPLATE_CART_REMINDER: 'cart_reminder',
    WHATSAPP_TEMPLATE_REVIEW_REQUEST: 'review_request',
    WHATSAPP_TEMPLATE_ADMIN_ALERT: 'admin_alert',
    WHATSAPP_TEMPLATE_OUT_FOR_DELIVERY: 'out_for_delivery',
    WHATSAPP_TEMPLATE_DELIVERY_FAILED: 'delivery_failed',
    ADMIN_ALERT_WHATSAPP_NUMBERS: '9876543210, 9123456780',
    FRONTEND_URL: 'https://krozenda.test',
  });
  global.fetch = jest.fn(async (url) => {
    sent.push(new URL(url).searchParams);
    return { ok: true, status: 200, text: async () => `S.${sent.length}` };
  });
});

beforeEach(() => {
  sent = [];
});

afterAll(async () => {
  global.fetch = realFetch;
  process.env = savedEnv;
  await disconnectTestDb();
});

const withTemplate = (name) => sent.filter((p) => p.get('text') === name);

// Seller/admin/buyer-alert WhatsApps are detached from the call that raised
// them, so wait for them to land (then a moment more, so a duplicate that
// should NOT have been sent would show up too).
async function sendsOf(name, expected, filter = () => true) {
  const pick = () => withTemplate(name).filter(filter);
  for (let i = 0; i < 100 && pick().length < expected; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  return pick();
}

function address(overrides = {}) {
  return {
    fullName: 'Rehan Multani',
    phone: '6268204871',
    line1: 'Line 1',
    city: 'Indore',
    state: 'MP',
    pincode: '452001',
    ...overrides,
  };
}

async function makeOrder(overrides = {}) {
  const { user } = overrides.user ? { user: overrides.user } : await createCustomer();
  const product = overrides.product || (await createProduct({ category: (await createCategory())._id }));
  return Order.create({
    user: user._id,
    items: [{ product: product._id, name: 'Kurta', price: 500, quantity: 2, vendor: overrides.vendor || null }],
    shippingAddress: address(),
    subtotal: 1000,
    total: 1000,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    ...overrides.fields,
  });
}

describe('one-off WhatsApp sends', () => {
  test('sendTemplateOnce sends once per key and skips unapproved templates', async () => {
    const args = { key: 'TEST:1', template: 'PAYMENT_PENDING', phone: '+91 98765 43210', params: ['A, B', 'Rs.1'] };
    expect(await whatsapp.sendTemplateOnce(args)).toMatchObject({ status: 'SENT' });
    expect(await whatsapp.sendTemplateOnce(args)).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].get('phone')).toBe('9876543210');
    // A comma inside a value would shift every later variable.
    expect(sent[0].get('Params')).toBe('A B,Rs.1');

    expect(await whatsapp.sendTemplateOnce({ ...args, key: 'TEST:2', template: 'VENDOR_SETTLEMENT' })).toBeNull();
    expect(sent).toHaveLength(1);
  });

  test('a seller gets one WhatsApp per order, counting only their own lines', async () => {
    const { vendor } = await createVendor({ name: 'Asha Traders' });
    const order = await makeOrder({ vendor: vendor._id });

    await vendorAlerts.notifyVendorsOfNewOrder(order);
    await vendorAlerts.notifyVendorsOfNewOrder(order);

    const messages = await sendsOf('vendor_new_order', 1);
    expect(messages).toHaveLength(1);
    expect(messages[0].get('phone')).toBe(vendor.mobile);
    expect(messages[0].get('Params').split(',')).toEqual(['Asha', whatsapp.orderNumber(order._id), '2', 'Rs.1000']);
    expect(await Notification.countDocuments({ vendor: vendor._id, title: 'New Order Received' })).toBe(2);
  });

  test('a seller who turned order updates off gets no WhatsApp', async () => {
    const { vendor } = await createVendor({ notificationPrefs: { orderUpdates: false, promotions: true } });
    const order = await makeOrder({ vendor: vendor._id });
    await vendorAlerts.notifyVendorsOfNewOrder(order);
    expect(await sendsOf('vendor_new_order', 0)).toHaveLength(0);
  });

  test('urgent admin alerts WhatsApp every admin number once per key', async () => {
    await alertAdmins({ event: 'X', title: 'Refund failed', message: 'ORD-1', key: 'X:1', urgent: true });
    await alertAdmins({ event: 'X', title: 'Refund failed', message: 'ORD-1', key: 'X:1', urgent: true });
    await alertAdmins({ event: 'Y', title: 'New seller', message: 'Asha', key: 'Y:1' });

    const messages = await sendsOf('admin_alert', 2);
    expect(messages.map((m) => m.get('phone')).sort()).toEqual(['9123456780', '9876543210']);
  });
});

describe('long admin alerts and CJ delivery milestones', () => {
  test('an urgent admin alert reaches WhatsApp in full, not cut at 60 characters', async () => {
    const message =
      'Dropship order ORD-1234ABCD (Rs.4599) was not accepted by CJ: product variant is out of stock at the CN warehouse. It was cancelled and refunded automatically.';
    await alertAdmins({ event: 'LONG', title: 'CJ order failed — buyer refunded', message, key: 'LONG:1', urgent: true });

    const messages = await sendsOf('admin_alert', 2);
    const [, details] = messages[0].get('Params').split(/,(.*)/s);
    expect(details).toBe(message.replace(',', ''));
  });

  test('CJ spells statuses loosely; the mapper still recognises them', () => {
    expect(mapTrackingStatus('Out for delivery')).toBe('OUT_FOR_DELIVERY');
    expect(mapTrackingStatus('delivery-failed')).toBe('DELIVERY_FAILED');
    expect(mapTrackingStatus('something new')).toBe('PROCESSING');
  });

  test('CJ out for delivery tells the buyer; a failed attempt also alerts admins', async () => {
    const order = await makeOrder({ fields: { fulfillmentType: 'DROPSHIP', status: 'SHIPPED' } });
    const shipment = await CjShipment.create({
      cjOrder: order._id, // any id: the milestone reads the Krozenda order from cjOrder below
      cjOrderId: `CJ${Date.now()}`,
      trackingNumber: 'YT123456789CN',
      carrier: 'YunExpress',
      status: 'OUT_FOR_DELIVERY',
    });
    const cjOrder = { krozendaOrderId: order._id };

    await notifyCjShipmentMilestone(shipment, cjOrder);
    await notifyCjShipmentMilestone(shipment, cjOrder); // same day: no second WhatsApp
    const out = await sendsOf('out_for_delivery', 1);
    expect(out).toHaveLength(1);
    expect(out[0].get('Params').split(',')).toEqual(['Rehan', whatsapp.orderNumber(order._id), 'YunExpress', 'YT123456789CN']);

    shipment.status = 'DELIVERY_FAILED';
    await notifyCjShipmentMilestone(shipment, cjOrder);
    expect(await sendsOf('delivery_failed', 1)).toHaveLength(1);
    expect(await NotificationDispatch.exists({ key: new RegExp(`^ADMIN:CJ_DELIVERY_FAILED:${shipment._id}`) })).toBeTruthy();
    const titles = (await Notification.find({ user: order.user }).lean()).map((n) => n.title);
    expect(titles).toEqual(expect.arrayContaining(['Out for delivery today', 'Delivery attempt failed']));
  });
});

describe('push preferences', () => {
  test('marketing respects the promotions switch, order updates respect their own', () => {
    expect(allowsPush({ promotions: false, orderUpdates: true }, 'OFFER')).toBe(false);
    expect(allowsPush({ promotions: false, orderUpdates: true }, 'ORDER')).toBe(true);
    expect(allowsPush({ promotions: true, orderUpdates: false }, 'ORDER')).toBe(false);
    expect(allowsPush({ promotions: false, orderUpdates: false }, 'SYSTEM')).toBe(true);
  });
});

describe('engagement job', () => {
  test('payment reminder: once, only when no order followed and the cart still has items', async () => {
    const { user } = await createCustomer({ name: 'Sana Khan' });
    const product = await createProduct({ category: (await createCategory())._id });
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 1 }] });
    const attempt = await CheckoutAttempt.create({ user: user._id, razorpayOrderId: `order_${Date.now()}`, amount: 1499 });
    // Straight to the collection: mongoose treats createdAt as immutable.
    await CheckoutAttempt.collection.updateOne({ _id: attempt._id }, { $set: { createdAt: new Date(Date.now() - 40 * MIN), failedAt: new Date() } });

    // A buyer who paid on a second try is left alone.
    const { user: paidUser } = await createCustomer();
    await Cart.create({ user: paidUser._id, items: [{ product: product._id, quantity: 1 }] });
    const paidAttempt = await CheckoutAttempt.create({ user: paidUser._id, razorpayOrderId: `order_p${Date.now()}`, amount: 99 });
    await CheckoutAttempt.collection.updateOne({ _id: paidAttempt._id }, { $set: { createdAt: new Date(Date.now() - 40 * MIN) } });
    await makeOrder({ user: paidUser, product });

    await job.sendPaymentReminders();
    await job.sendPaymentReminders();

    // Other suites share this database, so only this buyer's messages count.
    const messages = withTemplate('payment_pending').filter((m) => m.get('phone') === user.mobileNumber);
    expect(messages).toHaveLength(1);
    expect(messages[0].get('Params').split(',')).toEqual(['Sana', 'Rs.1499', 'https://krozenda.test/app/cart']);
    expect(await Notification.findOne({ user: user._id }).lean()).toMatchObject({ title: 'Your payment did not go through' });
    expect(await Notification.countDocuments({ user: paidUser._id, title: /payment/i })).toBe(0);
  });

  test('captured payment with no order alerts admins after the grace period', async () => {
    const { user } = await createCustomer();
    const attempt = await CheckoutAttempt.create({
      user: user._id,
      razorpayOrderId: `order_c${Date.now()}`,
      amount: 2500,
      capturedAt: new Date(Date.now() - 15 * MIN),
      razorpayPaymentId: `pay_${Date.now()}`,
    });

    await job.alertCapturedWithoutOrder();
    await job.alertCapturedWithoutOrder();
    const about = await sendsOf('admin_alert', 2, (m) => m.get('Params').includes('2500'));
    expect(about).toHaveLength(2);
    expect((await CheckoutAttempt.findById(attempt._id).lean()).captureAlertedAt).toBeTruthy();
  });

  test('abandoned cart: push after 1 h, push + WhatsApp after 24 h, each stage once', async () => {
    const { user } = await createCustomer({ name: 'Imran' });
    const product = await createProduct({ name: 'Blue Kurta', category: (await createCategory())._id });
    const cart = await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2 }] });
    await Cart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: new Date(Date.now() - 2 * HOUR) } });

    await job.sendCartReminders();
    await job.sendCartReminders();
    expect(await Notification.countDocuments({ user: user._id, title: 'You left something in your cart' })).toBe(1);
    expect(withTemplate('cart_reminder').filter((m) => m.get('phone') === user.mobileNumber)).toHaveLength(0);

    await Cart.collection.updateOne({ _id: cart._id }, { $set: { updatedAt: new Date(Date.now() - 25 * HOUR) } });
    await job.sendCartReminders();
    const messages = withTemplate('cart_reminder').filter((m) => m.get('phone') === user.mobileNumber);
    expect(messages).toHaveLength(1);
    expect(messages[0].get('Params').split(',')).toEqual(['Imran', '2', 'Blue Kurta', 'https://krozenda.test/app/cart']);
  });

  test('review request goes out 2–5 days after delivery, never for reviewed items', async () => {
    const order = await makeOrder({ fields: { status: 'DELIVERED', deliveredAt: new Date(Date.now() - 3 * DAY) } });
    const tooRecent = await makeOrder({ fields: { status: 'DELIVERED', deliveredAt: new Date(Date.now() - DAY) } });

    await job.sendReviewRequests();
    await job.sendReviewRequests();

    const messages = withTemplate('review_request').filter((m) => m.get('Params').includes(String(order._id)));
    expect(messages).toHaveLength(1);
    expect(messages[0].get('Params')).toContain(`https://krozenda.test/app/orders/${order._id}/review`);
    expect(await NotificationDispatch.exists({ key: `REVIEW_REQUEST:${tooRecent._id}` })).toBeNull();
  });

  test('wishlist: first look is silent, then back-in-stock and price drops alert once', async () => {
    const { user } = await createCustomer();
    const product = await createProduct({ name: 'Silver Ring', stock: 0, price: 1000, category: (await createCategory())._id });
    await Wishlist.create({ user: user._id, items: [{ product: product._id }] });

    await job.sendWishlistAlerts();
    expect(await Notification.countDocuments({ user: user._id })).toBe(0);

    await Product.updateOne({ _id: product._id }, { $set: { stock: 5 } });
    await job.sendWishlistAlerts();
    await job.sendWishlistAlerts();

    await Product.updateOne({ _id: product._id }, { $set: { price: 800 } });
    await job.sendWishlistAlerts();
    // A ₹5 wobble is not news.
    await Product.updateOne({ _id: product._id }, { $set: { price: 795 } });
    await job.sendWishlistAlerts();

    const titles = (await Notification.find({ user: user._id }).sort({ createdAt: 1 }).lean()).map((n) => n.title);
    expect(titles).toEqual(['Back in stock!', 'Price dropped on your wishlist']);
  });

  test('low stock alerts a seller once per dip and re-arms after a restock', async () => {
    const { vendor } = await createVendor();
    const product = await createProduct({ vendor: vendor._id, stock: 2, lowStockThreshold: 3, category: (await createCategory())._id });

    await job.sendLowStockAlerts();
    await job.sendLowStockAlerts();
    expect(await Notification.countDocuments({ vendor: vendor._id, title: 'Low stock alert' })).toBe(1);

    await Product.updateOne({ _id: product._id }, { $set: { stock: 20 } });
    await job.sendLowStockAlerts();
    await Product.updateOne({ _id: product._id }, { $set: { stock: 1 } });
    await job.sendLowStockAlerts();
    expect(await Notification.countDocuments({ vendor: vendor._id, title: 'Low stock alert' })).toBe(2);
  });
});
