// An order no seller accepted within 24h is cancelled automatically and a
// prepaid one is refunded: Razorpay payments to the original payment, wallet
// payments to the wallet, COD has nothing to refund.
jest.mock('../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const Notification = require('../Models/Notification');
const { autoCancelUnacceptedOrders } = require('../services/orderAutoCancelService');
const { connectTestDb, disconnectTestDb, createCustomer, createVendor, createProduct } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(() => {
  razorpay.payments.refund.mockReset().mockResolvedValue({ id: 'rfnd_1' });
});

const ADDRESS = { fullName: 'Test Buyer', phone: '9998887771', line1: '1 Test St', city: 'Testville', state: 'TS', pincode: '123456' };
const HOUR = 60 * 60 * 1000;

async function placeOrder({ paymentMethod, paymentStatus = 'PAID', hoursAgo, lineStatuses = ['PENDING'] }) {
  const { user } = await createCustomer();
  const { vendor } = await createVendor();
  const product = await createProduct({ vendor: vendor._id, stock: 10 });
  const items = lineStatuses.map((status) => ({
    product: product._id,
    name: product.name,
    price: 500,
    quantity: 1,
    vendor: vendor._id,
    total: 500,
    status,
    ...(status === 'PROCESSING' ? { acceptedAt: new Date() } : {}),
  }));
  const total = 500 * items.length;
  const order = await Order.create({
    user: user._id,
    items,
    shippingAddress: ADDRESS,
    subtotal: total,
    total,
    paymentMethod,
    paymentStatus,
    razorpayPaymentId: paymentMethod === 'RAZORPAY' ? `pay_${Math.random().toString(36).slice(2)}` : null,
  });
  await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt: new Date(Date.now() - hoursAgo * HOUR) } });
  return { order, user, vendor };
}

describe('auto-cancel of orders no seller accepted', () => {
  it('cancels an unaccepted Razorpay order after 24h and refunds the original payment', async () => {
    const { order, user, vendor } = await placeOrder({ paymentMethod: 'RAZORPAY', hoursAgo: 25 });
    await autoCancelUnacceptedOrders();

    const sellerNote = await Notification.findOne({ vendor: vendor._id, title: 'Order Auto-Cancelled' });
    expect(sellerNote).toBeTruthy();

    const after = await Order.findById(order._id);
    expect(after.status).toBe('CANCELLED');
    expect(after.cancelledBy).toBe('system');
    expect(after.paymentStatus).toBe('REFUNDED');
    expect(razorpay.payments.refund).toHaveBeenCalledWith(order.razorpayPaymentId, expect.objectContaining({ amount: 50000 }));
    expect((await Customer.findById(user._id)).walletBalance).toBe(0);
  });

  it('falls back to the wallet when Razorpay refuses the refund', async () => {
    razorpay.payments.refund.mockRejectedValue(new Error('gateway down'));
    const { order, user } = await placeOrder({ paymentMethod: 'RAZORPAY', hoursAgo: 30 });
    await autoCancelUnacceptedOrders();

    expect((await Order.findById(order._id)).status).toBe('CANCELLED');
    expect((await Customer.findById(user._id)).walletBalance).toBe(500);
  });

  it('cancels an unaccepted COD order with nothing to refund', async () => {
    const { order } = await placeOrder({ paymentMethod: 'COD', paymentStatus: 'PENDING', hoursAgo: 26 });
    await autoCancelUnacceptedOrders();

    const after = await Order.findById(order._id);
    expect(after.status).toBe('CANCELLED');
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('refunds a wallet-paid order to the wallet', async () => {
    const { order, user } = await placeOrder({ paymentMethod: 'WALLET', hoursAgo: 40 });
    await autoCancelUnacceptedOrders();

    expect((await Order.findById(order._id)).status).toBe('CANCELLED');
    expect((await Customer.findById(user._id)).walletBalance).toBe(500);
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('leaves an order under 24h old alone', async () => {
    const { order } = await placeOrder({ paymentMethod: 'RAZORPAY', hoursAgo: 5 });
    await autoCancelUnacceptedOrders();
    expect((await Order.findById(order._id)).status).toBe('PENDING');
    expect(razorpay.payments.refund).not.toHaveBeenCalled();
  });

  it('only cancels the lines nobody accepted', async () => {
    const { order } = await placeOrder({ paymentMethod: 'RAZORPAY', hoursAgo: 48, lineStatuses: ['PROCESSING', 'PENDING'] });
    await autoCancelUnacceptedOrders();

    const after = await Order.findById(order._id);
    expect(after.items[0].status).toBe('PROCESSING');
    expect(after.items[1].status).toBe('CANCELLED');
    expect(after.status).not.toBe('CANCELLED');
    expect(razorpay.payments.refund).toHaveBeenCalledTimes(1);
  });

  it('does not run twice on the same order', async () => {
    await placeOrder({ paymentMethod: 'RAZORPAY', hoursAgo: 25 });
    await autoCancelUnacceptedOrders();
    const calls = razorpay.payments.refund.mock.calls.length;
    await autoCancelUnacceptedOrders();
    expect(razorpay.payments.refund.mock.calls.length).toBe(calls);
  });
});
