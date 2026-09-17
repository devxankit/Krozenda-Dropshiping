// Covers the account-wide tools added so the assistant can answer A-to-Z about
// the signed-in customer. The rule under test throughout: every one of them
// returns the caller's own data and nothing of anybody else's.

const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const Notification = require('../Models/Notification');
const Ticket = require('../Models/Ticket');
const Review = require('../Models/Review');
const WalletTransaction = require('../Models/WalletTransaction');
const Customer = require('../Models/Customer');
const aiTools = require('../services/aiTools');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createProduct,
  createAddress,
  uniqueSuffix,
} = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

async function seedEverything(user, { marker }) {
  // WalletTransaction has a unique index on razorpayPaymentId, so the seeded
  // ids must differ per call, not just per marker.
  const nonce = uniqueSuffix();
  const product = await createProduct({ name: `${marker} Product`, price: 500 });

  await Customer.updateOne({ _id: user._id }, { $set: { walletBalance: 2500 } });

  await WalletTransaction.create({
    user: user._id,
    type: 'CREDIT',
    amount: 2500,
    balanceAfter: 2500,
    source: 'TOPUP',
    razorpayPaymentId: `pay_${marker}_${nonce}_SECRET`,
    razorpayOrderId: `order_${marker}_${nonce}_SECRET`,
  });

  await createAddress(user._id, { fullName: `${marker} Recipient`, isDefault: true });
  await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2 }] });
  await Wishlist.create({ user: user._id, items: [{ product: product._id }] });
  await Notification.create({
    user: user._id,
    type: 'ORDER',
    title: `${marker} Notification`,
    message: `${marker} body`,
    isRead: false,
  });

  const order = await Order.create({
    user: user._id,
    items: [{ product: product._id, name: `${marker} Product`, price: 500, quantity: 1 }],
    shippingAddress: {
      fullName: 'Buyer',
      phone: '9998887771',
      line1: '1 Road',
      city: 'Mumbai',
      state: 'MH',
      pincode: '400001',
    },
    subtotal: 500,
    total: 500,
    paymentMethod: 'COD',
    status: 'DELIVERED',
  });

  await Review.create({
    user: user._id,
    product: product._id,
    order: order._id,
    rating: 5,
    reviewText: `${marker} review text`,
  });

  await Ticket.create({
    ticketId: `TKT-${marker}-${uniqueSuffix().slice(-6)}`,
    user: user._id,
    name: 'Buyer',
    subject: `${marker} Subject`,
    category: 'General Inquiry',
    messages: [
      { sender: 'user', senderName: 'Buyer', message: `${marker} customer message` },
      // Staff-only annotation that happens to live on the same thread.
      { sender: 'agent', senderName: 'Agent', message: 'INTERNAL ONLY: flag this account', isInternal: true },
    ],
  });

  return { product, order };
}

describe('account-wide tools are scoped to the caller', () => {
  const TOOLS = [
    'getMyAccountOverview',
    'getMyProfile',
    'getMyWallet',
    'getMyAddresses',
    'getMyCart',
    'getMyWishlist',
    'getMyCouponUsage',
    'getMyNotifications',
    'getMySupportTickets',
    'getMyReviews',
  ];

  it('never returns another customer data from any tool', async () => {
    const alice = await createCustomer({ name: 'Alice' });
    const bob = await createCustomer({ name: 'Bob' });
    await seedEverything(alice.user, { marker: 'ALICE' });
    await seedEverything(bob.user, { marker: 'BOB' });

    for (const tool of TOOLS) {
      const result = JSON.stringify(await aiTools[tool](alice.user._id, {}));
      expect(result).not.toMatch(/BOB/);
      expect(result).not.toMatch(/Bob/);
    }
  });

  it('returns the caller own data from every tool', async () => {
    const alice = await createCustomer({ name: 'Alice' });
    await seedEverything(alice.user, { marker: 'ALICE' });

    const overview = await aiTools.getMyAccountOverview(alice.user._id);
    expect(overview.found).toBe(true);
    expect(overview.profile.name).toBe('Alice');
    expect(overview.wallet.balance).toBe(2500);
    expect(overview.savedAddresses).toBe(1);
    expect(overview.cartItems).toBe(1);
    expect(overview.wishlistItems).toBe(1);
    expect(overview.supportTickets).toBe(1);
    expect(overview.reviewsWritten).toBe(1);
    expect(overview.unreadNotifications).toBe(1);
    expect(overview.orders.countsByStatus.Delivered).toBe(1);
  });
});

describe('wallet', () => {
  it('reports the real balance and ledger', async () => {
    const { user } = await createCustomer();
    await seedEverything(user, { marker: 'W' });

    const wallet = await aiTools.getMyWallet(user._id, {});

    expect(wallet.balance).toBe(2500);
    expect(wallet.currency).toBe('INR');
    expect(wallet.recentTransactions[0]).toMatchObject({ type: 'CREDIT', amount: 2500, reason: 'Wallet top-up' });
  });

  it('never leaks payment gateway identifiers', async () => {
    const { user } = await createCustomer();
    await seedEverything(user, { marker: 'W' });

    const serialized = JSON.stringify(await aiTools.getMyWallet(user._id, {}));

    expect(serialized).not.toMatch(/pay_/);
    expect(serialized).not.toMatch(/order_/);
    expect(serialized).not.toMatch(/razorpay/i);
  });

  it('caps how many transactions one call returns', async () => {
    const { user } = await createCustomer();
    for (let i = 0; i < 15; i += 1) {
      await WalletTransaction.create({
        user: user._id,
        type: 'DEBIT',
        amount: 10,
        balanceAfter: 100,
        source: 'ORDER_PAYMENT',
      });
    }

    const wallet = await aiTools.getMyWallet(user._id, { limit: 500 });
    expect(wallet.recentTransactions).toHaveLength(10);
  });
});

describe('support tickets', () => {
  it('never exposes internal staff notes', async () => {
    const { user } = await createCustomer();
    await seedEverything(user, { marker: 'T' });

    const result = await aiTools.getMySupportTickets(user._id, {});
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/INTERNAL ONLY/);
    expect(serialized).not.toMatch(/flag this account/);
    // The internal note must not be counted either, nor be "the last reply".
    expect(result.tickets[0].messageCount).toBe(1);
    expect(result.tickets[0].lastMessage.text).toMatch(/customer message/);
  });
});

describe('cart and wishlist', () => {
  it('excludes a product that was delisted after being added', async () => {
    const { user } = await createCustomer();
    const active = await createProduct({ name: 'Still Listed', price: 100 });
    const delisted = await createProduct({ name: 'Delisted Item', price: 100, isActive: false });

    await Cart.create({
      user: user._id,
      items: [{ product: active._id, quantity: 1 }, { product: delisted._id, quantity: 1 }],
    });
    await Wishlist.create({
      user: user._id,
      items: [{ product: active._id }, { product: delisted._id }],
    });

    const cart = await aiTools.getMyCart(user._id);
    const wishlist = await aiTools.getMyWishlist(user._id, {});

    expect(cart.items).toHaveLength(1);
    expect(JSON.stringify(cart)).not.toMatch(/Delisted Item/);
    expect(wishlist.items).toHaveLength(1);
    expect(JSON.stringify(wishlist)).not.toMatch(/Delisted Item/);
  });

  it('prices the cart on sale price and flags it as items-only', async () => {
    const { user } = await createCustomer();
    const product = await createProduct({ name: 'Discounted', price: 1000, salePrice: 700 });
    await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 2 }] });

    const cart = await aiTools.getMyCart(user._id);

    expect(cart.itemsSubtotal).toBe(1400);
    expect(cart.note).toMatch(/Delivery charges/);
  });

  it('reports an empty cart plainly', async () => {
    const { user } = await createCustomer();
    const cart = await aiTools.getMyCart(user._id);

    expect(cart.itemCount).toBe(0);
    expect(cart.note).toMatch(/empty/);
  });
});

describe('profile', () => {
  it('returns the caller own contact details unmasked', async () => {
    const email = `rahul${uniqueSuffix()}@example.com`;
    const { user } = await createCustomer({ name: 'Rahul', email });

    const profile = await aiTools.getMyProfile(user._id);

    // Their own details, already visible on the Edit Profile screen.
    expect(profile.name).toBe('Rahul');
    expect(profile.email).toBe(email);
    expect(profile.mobileNumber).toBe(user.mobileNumber);
  });

  it('still never returns a password field', async () => {
    const { user } = await createCustomer({ password: 'secret123' });

    const profile = await aiTools.getMyProfile(user._id);
    const serialized = JSON.stringify(profile);

    expect(Object.keys(profile)).not.toContain('password');
    expect(serialized).not.toMatch(/secret123/);
    expect(serialized).not.toMatch(/\$2[aby]\$/);
  });

  it('returns not-found for an id that is not a real account', async () => {
    const profile = await aiTools.getMyProfile(new mongoose.Types.ObjectId());
    expect(profile.found).toBe(false);
  });
});

describe('addresses', () => {
  it('returns only the caller addresses, default first', async () => {
    const alice = await createCustomer();
    const bob = await createCustomer();
    await createAddress(alice.user._id, { fullName: 'Alice Home', isDefault: false });
    await createAddress(alice.user._id, { fullName: 'Alice Office', isDefault: true });
    await createAddress(bob.user._id, { fullName: 'Bob Home', isDefault: true });

    const result = await aiTools.getMyAddresses(alice.user._id);

    expect(result.addresses).toHaveLength(2);
    expect(result.addresses[0].recipient).toBe('Alice Office');
    expect(JSON.stringify(result)).not.toMatch(/Bob/);
  });
});
