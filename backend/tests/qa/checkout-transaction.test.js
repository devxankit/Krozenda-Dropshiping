// QA-016 regression: checkout's writes (stock, wallet, orders, wallet ledger,
// emptied cart) commit together or not at all. Each case below fails one
// step AFTER earlier ones have written, the way a crash or a dropped DB
// connection would, and checks nothing was left half-done.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Customer = require('../../Models/Customer');
const Cart = require('../../Models/Cart');
const WalletTransaction = require('../../Models/WalletTransaction');
const {
  connectTestDb,
  disconnectTestDb,
  createProduct,
  buyerWithAddress,
  addToCart,
  as,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.restoreAllMocks());

async function walletCheckoutSetup() {
  const product = await createProduct({ stock: 5, price: 400, gstRate: 0 });
  const b = await buyerWithAddress({ walletBalance: 10000 });
  await addToCart(b.token, product._id, 2);
  return { product, b };
}

async function expectNothingChanged({ product, b }) {
  expect(await Order.countDocuments({ user: b.user._id })).toBe(0);
  expect((await Product.findById(product._id)).stock).toBe(5);
  expect((await Customer.findById(b.user._id)).walletBalance).toBe(10000);
  expect(await WalletTransaction.countDocuments({ user: b.user._id, source: 'ORDER_PAYMENT' })).toBe(0);
  expect((await Cart.findOne({ user: b.user._id })).items).toHaveLength(1);
}

const placeWallet = (b) => as(b.token).post('/user/orders', { addressId: String(b.address._id), paymentMethod: 'WALLET' });

test('the wallet ledger write failing after stock, wallet and order were written rolls all of them back', async () => {
  const ctx = await walletCheckoutSetup();
  jest.spyOn(WalletTransaction, 'create').mockRejectedValueOnce(new Error('connection reset'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await placeWallet(ctx.b);
  expect(res.status).toBe(500);
  await expectNothingChanged(ctx);
});

test('emptying the cart failing (last step) rolls back the order, stock and wallet too', async () => {
  const ctx = await walletCheckoutSetup();
  const real = Cart.updateOne.bind(Cart);
  jest.spyOn(Cart, 'updateOne').mockImplementation((filter, update, options) => {
    if (options?.session) return Promise.reject(new Error('primary stepped down'));
    return real(filter, update, options);
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await placeWallet(ctx.b);
  expect(res.status).toBe(500);
  await expectNothingChanged(ctx);
});

test('a failed checkout can simply be retried and succeeds', async () => {
  const ctx = await walletCheckoutSetup();
  jest.spyOn(WalletTransaction, 'create').mockRejectedValueOnce(new Error('connection reset'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect((await placeWallet(ctx.b)).status).toBe(500);
  jest.restoreAllMocks();
  const retry = await placeWallet(ctx.b);
  expect(retry.status).toBe(201);
  expect((await Product.findById(ctx.product._id)).stock).toBe(3);
  expect((await Customer.findById(ctx.b.user._id)).walletBalance).toBe(10000 - retry.body.data.total);
  expect(await WalletTransaction.countDocuments({ user: ctx.b.user._id, source: 'ORDER_PAYMENT' })).toBe(1);
  expect((await Cart.findOne({ user: ctx.b.user._id })).items).toHaveLength(0);
});

test('insufficient wallet balance leaves stock untouched (rolled back, not released by hand)', async () => {
  const product = await createProduct({ stock: 5, price: 400, gstRate: 0 });
  const b = await buyerWithAddress({ walletBalance: 10 });
  await addToCart(b.token, product._id, 2);
  const res = await placeWallet(b);
  expect(res.status).toBe(400);
  expect(res.body.message).toBe('Insufficient wallet balance');
  expect((await Product.findById(product._id)).stock).toBe(5);
});

test('a successful wallet checkout writes all five things', async () => {
  const ctx = await walletCheckoutSetup();
  const res = await placeWallet(ctx.b);
  expect(res.status).toBe(201);
  expect(await Order.countDocuments({ user: ctx.b.user._id })).toBe(1);
  expect((await Product.findById(ctx.product._id)).stock).toBe(3);
  const wallet = (await Customer.findById(ctx.b.user._id)).walletBalance;
  const ledger = await WalletTransaction.findOne({ user: ctx.b.user._id, source: 'ORDER_PAYMENT' });
  expect(ledger.balanceAfter).toBe(wallet);
  expect(ledger.orderId.toString()).toBe(res.body.data.id);
  expect((await Cart.findOne({ user: ctx.b.user._id })).items).toHaveLength(0);
});
