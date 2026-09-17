// Exercises the production migration against a real database before it is
// pointed at the live one. The properties that matter: buyers arrive with the
// SAME _id (so every order/cart/wallet reference keeps resolving), staff and
// admins are left where they are, and a second run changes nothing.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Customer = require('../Models/Customer');
const User = require('../Models/User');
const Order = require('../Models/Order');
const { run } = require('../migrate-customers');
const { connectTestDb, disconnectTestDb, createProduct, uniqueSuffix } = require('./helpers');

jest.setTimeout(60000);
beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// The migration reads the raw `users` collection, which is exactly where
// buyers sat BEFORE the split. Mongoose would now reject role: 'customer'
// against the narrowed User schema, so these go in through the driver — the
// same shape a real pre-migration document has.
async function seedLegacyBuyer(overrides = {}) {
  const suffix = uniqueSuffix().slice(-9);
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Legacy Buyer',
    email: `legacy${uniqueSuffix()}@example.com`,
    mobileNumber: `9${suffix.padStart(9, '0')}`.slice(0, 10),
    password: await bcrypt.hash('secret123', 10),
    role: 'customer',
    walletBalance: 750,
    gender: 'male',
    fcmTokens: [{ token: `tok-${uniqueSuffix()}`, deviceType: 'web' }],
    isActive: true,
    isDeleted: false,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-02-01'),
    ...overrides,
  };
  await mongoose.connection.collection('users').insertOne(doc);
  return doc;
}

async function migrate(opts = {}) {
  return run({ connect: false, close: false, ...opts });
}

beforeEach(async () => {
  await mongoose.connection.collection('users').deleteMany({});
  await mongoose.connection.collection('customers').deleteMany({});
});

describe('dry run', () => {
  it('reports what it would do and writes nothing', async () => {
    await seedLegacyBuyer();
    await seedLegacyBuyer();

    const result = await migrate({ apply: false });

    expect(result).toMatchObject({ dryRun: true, buyers: 2, toCopy: 2 });
    expect(await Customer.countDocuments()).toBe(0);
  });
});

describe('apply', () => {
  it('copies buyers preserving _id, so existing references still resolve', async () => {
    const legacy = await seedLegacyBuyer();

    // An order placed BEFORE the migration, pointing at the old id.
    const product = await createProduct({ price: 500 });
    await Order.create({
      user: legacy._id,
      items: [{ product: product._id, name: 'Thing', price: 500, quantity: 1 }],
      shippingAddress: {
        fullName: 'Legacy Buyer',
        phone: '9998887771',
        line1: '1 Road',
        city: 'Indore',
        state: 'MP',
        pincode: '452001',
      },
      subtotal: 500,
      total: 500,
      paymentMethod: 'COD',
    });

    await migrate({ apply: true });

    const customer = await Customer.findById(legacy._id);
    expect(customer).not.toBeNull();
    // The whole point: same id, so the pre-existing order still joins.
    expect(customer._id.toString()).toBe(legacy._id.toString());
    expect(await Order.countDocuments({ user: customer._id })).toBe(1);
  });

  it('carries the buyer fields across intact', async () => {
    const legacy = await seedLegacyBuyer();

    await migrate({ apply: true });

    const customer = await Customer.findById(legacy._id).select('+password');
    expect(customer.name).toBe('Legacy Buyer');
    expect(customer.email).toBe(legacy.email);
    expect(customer.mobileNumber).toBe(legacy.mobileNumber);
    expect(customer.walletBalance).toBe(750);
    expect(customer.gender).toBe('male');
    expect(customer.fcmTokens).toHaveLength(1);
    expect(customer.createdAt.toISOString()).toBe(legacy.createdAt.toISOString());
    // The hash is copied verbatim, so an existing password keeps working and
    // is NOT re-hashed into something unusable.
    expect(customer.password).toBe(legacy.password);
    expect(await bcrypt.compare('secret123', customer.password)).toBe(true);
  });

  it('drops the staff-permission fields', async () => {
    const legacy = await seedLegacyBuyer();
    await migrate({ apply: true });

    const raw = await mongoose.connection.collection('customers').findOne({ _id: legacy._id });
    expect(raw.role).toBeUndefined();
    expect(raw.roleId).toBeUndefined();
    expect(raw.createdBy).toBeUndefined();
  });

  it('leaves admins and staff in users and does not copy them', async () => {
    await seedLegacyBuyer();
    const admin = await User.create({
      name: 'Admin', email: `admin${uniqueSuffix()}@x.com`, role: 'admin', isActive: true,
    });
    const staff = await User.create({
      name: 'Staff', email: `staff${uniqueSuffix()}@x.com`, role: 'staff', isActive: true,
    });

    await migrate({ apply: true });

    expect(await Customer.countDocuments()).toBe(1);
    expect(await Customer.findById(admin._id)).toBeNull();
    expect(await Customer.findById(staff._id)).toBeNull();
    // Still where they were.
    expect(await User.findById(admin._id)).not.toBeNull();
    expect(await User.findById(staff._id)).not.toBeNull();
  });

  it('copies soft-deleted buyers too, so their order history is not orphaned', async () => {
    const deleted = await seedLegacyBuyer({ isDeleted: true });
    await migrate({ apply: true });

    const customer = await Customer.findById(deleted._id);
    expect(customer).not.toBeNull();
    expect(customer.isDeleted).toBe(true);
  });

  it('leaves the originals in users by default', async () => {
    const legacy = await seedLegacyBuyer();
    await migrate({ apply: true });

    const stillThere = await mongoose.connection.collection('users').findOne({ _id: legacy._id });
    expect(stillThere).not.toBeNull();
  });

  it('is idempotent — a second run copies nothing more', async () => {
    await seedLegacyBuyer();
    await seedLegacyBuyer();

    const first = await migrate({ apply: true });
    const second = await migrate({ apply: true });

    expect(first.copied).toBe(2);
    expect(second.copied).toBe(0);
    expect(await Customer.countDocuments()).toBe(2);
  });
});

describe('safety', () => {
  it('refuses to write when a buyer re-registered after the split', async () => {
    // The realistic collision: the same person now exists twice — their old
    // `users` row, and a fresh `customers` row created by signing up again.
    // Same email, different _id, so copying would hit the unique index.
    const email = `clash${uniqueSuffix()}@example.com`;
    const legacy = await seedLegacyBuyer({ email });
    const reRegistered = await Customer.create({ name: 'Same Person', email, isActive: true });

    await expect(migrate({ apply: true })).rejects.toThrow(/unique-index conflict/);

    // Only the post-split account exists; nothing was half-written.
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Customer.findById(legacy._id)).toBeNull();
    expect(await Customer.findById(reRegistered._id)).not.toBeNull();
  });

  it('flags a mobile-number collision the same way', async () => {
    const mobileNumber = '9876500011';
    await seedLegacyBuyer({ mobileNumber });
    await Customer.create({ name: 'Same Person', mobileNumber, isActive: true });

    await expect(migrate({ apply: true })).rejects.toThrow(/unique-index conflict/);
    expect(await Customer.countDocuments()).toBe(1);
  });

  it('only prunes buyers that are verifiably in the new collection', async () => {
    const legacy = await seedLegacyBuyer();
    const admin = await User.create({
      name: 'Admin', email: `admin${uniqueSuffix()}@x.com`, role: 'admin', isActive: true,
    });

    await migrate({ apply: true, prune: true });

    // Buyer moved out...
    expect(await mongoose.connection.collection('users').findOne({ _id: legacy._id })).toBeNull();
    expect(await Customer.findById(legacy._id)).not.toBeNull();
    // ...admin untouched.
    expect(await User.findById(admin._id)).not.toBeNull();
  });
});
