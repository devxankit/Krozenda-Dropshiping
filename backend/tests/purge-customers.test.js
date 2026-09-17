// Verifies the destructive purge against a real database before it is pointed
// at a live one. Two properties matter equally: everything buyer-owned goes,
// and nothing else does.

const mongoose = require('mongoose');
const Customer = require('../Models/Customer');
const User = require('../Models/User');
const Order = require('../Models/Order');
const Cart = require('../Models/Cart');
const Wishlist = require('../Models/Wishlist');
const Address = require('../Models/Address');
const WalletTransaction = require('../Models/WalletTransaction');
const Review = require('../Models/Review');
const Ticket = require('../Models/Ticket');
const Notification = require('../Models/Notification');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponRedemption = require('../Models/CouponRedemption');
const AiConversation = require('../Models/AiConversation');
const AiMessage = require('../Models/AiMessage');
const Vendor = require('../Models/Vendor');
const { run } = require('../purge-customers');
const {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createProduct,
  createVendor,
  createAddress,
  uniqueSuffix,
} = require('./helpers');

jest.setTimeout(60000);
beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const purge = (opts = {}) => run({ connect: false, close: false, ...opts });

const COLLECTIONS = [
  'customers', 'users', 'orders', 'carts', 'wishlists', 'addresses',
  'wallettransactions', 'reviews', 'returnrequests', 'tickets', 'notifications',
  'aiconversations', 'aimessages', 'couponredemptions', 'couponuserusages',
  'products', 'coupons', 'vendors', 'rtos', 'settlements', 'accountingtransactions',
];

beforeEach(async () => {
  await Promise.all(COLLECTIONS.map((n) => mongoose.connection.collection(n).deleteMany({})));
});

async function seedBuyerWithEverything() {
  const { user } = await createCustomer({ name: 'Doomed Buyer' });
  const product = await createProduct({ price: 500, rating: 4.5, reviewsCount: 1 });

  const order = await Order.create({
    user: user._id,
    items: [{ product: product._id, name: 'Thing', price: 500, quantity: 1 }],
    shippingAddress: {
      fullName: 'Doomed Buyer', phone: '9998887771', line1: '1 Road',
      city: 'Indore', state: 'MP', pincode: '452001',
    },
    subtotal: 500, total: 500, paymentMethod: 'COD',
  });

  await createAddress(user._id);
  await Cart.create({ user: user._id, items: [{ product: product._id, quantity: 1 }] });
  await Wishlist.create({ user: user._id, items: [{ product: product._id }] });
  await WalletTransaction.create({
    user: user._id, type: 'CREDIT', amount: 100, balanceAfter: 100, source: 'TOPUP',
  });
  await Review.create({ user: user._id, product: product._id, order: order._id, rating: 4 });
  await Notification.create({ user: user._id, type: 'ORDER', title: 'Hi', message: 'There' });
  await Ticket.create({
    ticketId: `TKT-${uniqueSuffix().slice(-8)}`, user: user._id, name: 'Doomed Buyer',
    subject: 'Help', category: 'General Inquiry', raisedByRole: 'customer',
  });
  const convo = await AiConversation.create({ user: user._id, title: 'chat' });
  await AiMessage.create({
    conversation: convo._id, user: user._id, role: 'user', message: 'hello',
  });

  const coupon = await Coupon.create({
    code: `SAVE${uniqueSuffix().slice(-6)}`,
    discountType: 'FIXED',
    discountValue: 50,
    usedCount: 1,
    isActive: true,
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 86400000),
  });
  await CouponRedemption.create({
    couponId: coupon._id, userId: user._id, orderId: order._id, discountAmount: 50,
  });

  return { user, product, order, coupon };
}

describe('dry run', () => {
  it('counts without deleting anything', async () => {
    await seedBuyerWithEverything();

    const result = await purge({ apply: false });

    expect(result.buyers).toBe(1);
    expect(result.applied).toBeFalsy();
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('refuses to write with --apply but no confirmation', async () => {
    await seedBuyerWithEverything();

    await purge({ apply: true, confirm: false });

    expect(await Customer.countDocuments()).toBe(1);
    expect(await Order.countDocuments()).toBe(1);
  });
});

describe('apply', () => {
  it('removes the buyer and everything they owned', async () => {
    await seedBuyerWithEverything();

    await purge({ apply: true, confirm: true });

    expect(await Customer.countDocuments()).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Cart.countDocuments()).toBe(0);
    expect(await Wishlist.countDocuments()).toBe(0);
    expect(await Address.countDocuments()).toBe(0);
    expect(await WalletTransaction.countDocuments()).toBe(0);
    expect(await Review.countDocuments()).toBe(0);
    expect(await Ticket.countDocuments()).toBe(0);
    expect(await Notification.countDocuments()).toBe(0);
    expect(await AiConversation.countDocuments()).toBe(0);
    expect(await AiMessage.countDocuments()).toBe(0);
    expect(await CouponRedemption.countDocuments()).toBe(0);
  });

  it('also removes legacy buyers still sitting in users', async () => {
    // A database where the split migration has not run yet.
    await mongoose.connection.collection('users').insertOne({
      _id: new mongoose.Types.ObjectId(),
      name: 'Legacy Buyer',
      email: `legacy${uniqueSuffix()}@example.com`,
      role: 'customer',
      isActive: true,
    });

    await purge({ apply: true, confirm: true });

    expect(await mongoose.connection.collection('users').countDocuments({ role: 'customer' })).toBe(0);
  });

  it('leaves admins, staff and sellers alone', async () => {
    await seedBuyerWithEverything();
    const admin = await User.create({
      name: 'Admin', email: `admin${uniqueSuffix()}@x.com`, role: 'admin', isActive: true,
    });
    const staff = await User.create({
      name: 'Staff', email: `staff${uniqueSuffix()}@x.com`, role: 'staff', isActive: true,
    });
    const { vendor } = await createVendor();

    await purge({ apply: true, confirm: true });

    expect(await User.findById(admin._id)).not.toBeNull();
    expect(await User.findById(staff._id)).not.toBeNull();
    expect(await Vendor.findById(vendor._id)).not.toBeNull();
  });

  it('leaves the catalog and coupons in place', async () => {
    const { product, coupon } = await seedBuyerWithEverything();

    await purge({ apply: true, confirm: true });

    expect(await Product.findById(product._id)).not.toBeNull();
    expect(await Coupon.findById(coupon._id)).not.toBeNull();
  });

  it('leaves vendor-raised tickets and vendor notifications alone', async () => {
    await seedBuyerWithEverything();
    const { vendor } = await createVendor();
    const vendorTicket = await Ticket.create({
      ticketId: `TKT-${uniqueSuffix().slice(-8)}`, vendor: vendor._id, name: 'Seller',
      subject: 'Payout query', category: 'General Inquiry', raisedByRole: 'vendor',
    });
    const vendorNote = await Notification.create({
      vendor: vendor._id, type: 'SYSTEM', title: 'Seller notice', message: 'Read this',
    });

    await purge({ apply: true, confirm: true });

    expect(await Ticket.findById(vendorTicket._id)).not.toBeNull();
    expect(await Notification.findById(vendorNote._id)).not.toBeNull();
  });

  it('resets the denormalised review counters it invalidated', async () => {
    const { product } = await seedBuyerWithEverything();

    await purge({ apply: true, confirm: true });

    // The review is gone, so the product must not keep advertising a rating.
    const fresh = await Product.findById(product._id);
    expect(fresh.reviewsCount).toBe(0);
    expect(fresh.rating).toBe(0);
  });

  it('resets coupon usedCount so coupons are usable again', async () => {
    const { coupon } = await seedBuyerWithEverything();

    await purge({ apply: true, confirm: true });

    expect((await Coupon.findById(coupon._id)).usedCount).toBe(0);
  });

  it('is safe to run twice', async () => {
    await seedBuyerWithEverything();

    await purge({ apply: true, confirm: true });
    const second = await purge({ apply: true, confirm: true });

    expect(second.buyers).toBe(0);
  });

  it('does nothing on a database with no buyers', async () => {
    const admin = await User.create({
      name: 'Admin', email: `admin${uniqueSuffix()}@x.com`, role: 'admin', isActive: true,
    });

    const result = await purge({ apply: true, confirm: true });

    expect(result.buyers).toBe(0);
    expect(await User.findById(admin._id)).not.toBeNull();
  });
});
