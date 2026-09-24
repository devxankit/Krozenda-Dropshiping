const mongoose = require('mongoose');
const { signToken } = require('../utils/jwt');
const User = require('../Models/User');
const Customer = require('../Models/Customer');
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const Address = require('../Models/Address');
const Vendor = require('../Models/Vendor');

const os = require('os');

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URL, {
      runtimeAdapters: { os }
    });
  }
  // Carrier quoting off by default. Shipping became ON by default with the
  // single-admin Shiprocket policy, and with no carrier account or origin in
  // a test database every checkout would then fail its delivery quote. The
  // suites that test shipping itself (shipping-foundation, dropship-checkout)
  // reset and configure these settings on their own.
  const ShippingSettings = require('../Models/ShippingSettings');
  await ShippingSettings.updateOne(
    { key: 'GLOBAL' },
    { $set: { shippingEnabled: false, sellerOwnAccountEnabled: false, policyVersion: 2 } },
    { upsert: true }
  );
}

async function disconnectTestDb() {
  await mongoose.disconnect();
}

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}${counter}`;
}

async function createCustomer(overrides = {}) {
  const suffix = uniqueSuffix().slice(-9);
  const user = await Customer.create({
    name: 'Test Customer',
    mobileNumber: `9${suffix.padStart(9, '0')}`.slice(0, 10),
    isActive: true,
    ...overrides,
  });
  const token = signToken('user', { id: user._id.toString(), role: 'customer', mobileNumber: user.mobileNumber });
  return { user, token };
}

async function createAdmin(overrides = {}) {
  const suffix = uniqueSuffix();
  const admin = await User.create({
    name: 'Test Admin',
    email: `admin${suffix}@test.local`,
    role: 'admin',
    isActive: true,
    ...overrides,
  });
  const token = signToken('admin', { id: admin._id.toString(), role: 'admin', permissions: [] });
  return { admin, token };
}

async function createVendor(overrides = {}) {
  const suffix = uniqueSuffix();
  const vendor = await Vendor.create({
    vendorType: 'B2C',
    name: 'Test Vendor',
    email: `vendor${suffix}@test.local`,
    mobile: `8${suffix.slice(-9).padStart(9, '0')}`.slice(0, 10),
    password: 'secret123',
    isActive: true,
    ...overrides,
  });
  const token = signToken('vendor', { id: vendor._id.toString(), vendorType: vendor.vendorType });
  return { vendor, token };
}

async function createCategory(overrides = {}) {
  return Category.create({ name: `Test Category ${uniqueSuffix()}`, isActive: true, ...overrides });
}

async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory());
  return Product.create({
    name: `Test Product ${uniqueSuffix()}`,
    category: category._id || category,
    price: 1000,
    stock: 10,
    isActive: true,
    ...overrides,
  });
}

async function createAddress(userId, overrides = {}) {
  return Address.create({
    user: userId,
    fullName: 'Test Buyer',
    phone: '9998887771',
    line1: '123 Test Street',
    city: 'Testville',
    state: 'TS',
    pincode: '123456',
    ...overrides,
  });
}

module.exports = {
  connectTestDb,
  disconnectTestDb,
  createCustomer,
  createAdmin,
  createVendor,
  createCategory,
  createProduct,
  createAddress,
  uniqueSuffix,
};
