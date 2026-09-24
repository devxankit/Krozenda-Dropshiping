const Order = require('../Models/Order');
const { cleanParam, normalisePhone } = require('../services/whatsappService');
const { connectTestDb, disconnectTestDb, createCustomer, createCategory, createProduct } = require('./helpers');

// The gateway is never reached: fetch is replaced for the whole file, and the
// env is switched to a non-test ENV only so the service agrees to "send".
const realFetch = global.fetch;
const savedEnv = { ...process.env };
let sent;

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    ENV: 'production',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_USER: 'u',
    WHATSAPP_PASS: 'p',
    WHATSAPP_SENDER: 'BUZWAP',
    WHATSAPP_TEMPLATE_DEFAULT: 'order_update',
    WHATSAPP_TEMPLATE_ORDER_SHIPPED: 'order_shipped',
    WHATSAPP_TEMPLATE_ORDER_CANCELLED: 'order_cancelled',
    WHATSAPP_TEMPLATE_ORDER_CONFIRMED: '',
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

// Sends are detached from the write that triggered them.
async function settle(orderId, count) {
  for (let i = 0; i < 250; i += 1) {
    const order = await Order.findById(orderId).lean();
    const done = (order.whatsappLog || []).filter((row) => row.status !== 'SENDING');
    if (done.length >= count) return order;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return Order.findById(orderId).lean();
}

async function makeOrder(overrides = {}) {
  const { user: customer } = await createCustomer();
  const category = await createCategory();
  const product = await createProduct({ category: category._id });
  return Order.create({
    user: customer._id,
    items: [{ product: product._id, name: 'Kurta', price: 999, quantity: 1 }],
    shippingAddress: {
      fullName: 'Rehan, Multani',
      phone: '+91 62682 04871',
      line1: 'Line 1',
      city: 'Indore',
      state: 'MP',
      pincode: '452001',
    },
    subtotal: 999,
    total: 999,
    paymentMethod: 'RAZORPAY',
    paymentStatus: 'PAID',
    ...overrides,
  });
}

describe('WhatsApp order updates', () => {
  test('placing an order sends the approved template with clean params', async () => {
    const order = await makeOrder();
    const saved = await settle(order._id, 1);

    expect(sent).toHaveLength(1);
    expect(sent[0].get('text')).toBe('order_update');
    expect(sent[0].get('phone')).toBe('6268204871');
    expect(sent[0].get('priority')).toBe('wa');
    const params = sent[0].get('Params').split(',');
    expect(params).toHaveLength(4);
    expect(params[0]).toBe('Rehan');
    expect(params[1]).toBe(`ORD-${String(order._id).slice(-8).toUpperCase()}`);
    expect(params[2]).toBe('Rs.999');
    expect(saved.whatsappLog[0]).toMatchObject({ event: 'PLACED', status: 'SENT', messageId: '1' });
  });

  test('status updates through findOneAndUpdate and save each message once', async () => {
    const order = await makeOrder();
    await settle(order._id, 1);
    sent = [];

    // No approved template for PROCESSING: skipped, not sent with the wrong text.
    await Order.findOneAndUpdate({ _id: order._id, status: 'PENDING' }, { $set: { status: 'PROCESSING' } });
    // A seller shipping the only line ships the order.
    const doc = await Order.findById(order._id);
    doc.items[0].status = 'SHIPPED';
    doc.items[0].courierName = 'Delhivery';
    doc.items[0].trackingNumber = 'AWB123';
    await doc.save();
    // Same move again (webhook retry) must not message twice.
    await Order.updateOne({ _id: order._id }, { $set: { status: 'SHIPPED' } });

    const saved = await settle(order._id, 2);
    expect(sent.map((p) => p.get('text'))).toEqual(['order_shipped']);
    expect(sent[0].get('Params')).toContain('Delhivery,AWB123');
    expect(saved.whatsappLog.map((row) => row.event)).toEqual(['PLACED', 'SHIPPED']);
  });

  test('cancellation says where the refund goes', async () => {
    const order = await makeOrder();
    await settle(order._id, 1);
    sent = [];

    await Order.findOneAndUpdate({ _id: order._id }, { $set: { status: 'CANCELLED' } }, { new: false });
    await settle(order._id, 2);
    expect(sent).toHaveLength(1);
    expect(sent[0].get('Params')).toContain('credited to your Krozenda wallet');
  });

  test('helpers keep the wire format safe', () => {
    expect(cleanParam('A, B\nC')).toBe('A B C');
    expect(cleanParam('')).toBe('-');
    expect(normalisePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalisePhone('12345')).toBeNull();
  });
});
