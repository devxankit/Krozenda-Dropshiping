const mongoose = require('mongoose');
const { signToken } = require('../utils/jwt');
const User = require('../Models/User');
const Category = require('../Models/Category');
const Product = require('../Models/Product');
const Address = require('../Models/Address');

async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URL);
  }
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
  const user = await User.create({
    name: 'Test Customer',
    mobileNumber: `9${suffix.padStart(9, '0')}`.slice(0, 10),
    role: 'customer',
    isActive: true,
    ...overrides,
  });
  const token = signToken('user', { id: user._id.toString(), role: user.role, mobileNumber: user.mobileNumber });
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
  createCategory,
  createProduct,
  createAddress,
  uniqueSuffix,
};
