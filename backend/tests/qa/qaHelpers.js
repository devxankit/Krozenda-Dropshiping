// Shared fixtures for the QA audit suites in tests/qa.
//
// knownBug(): a confirmed defect is recorded as a jest `test.failing` whose
// body asserts the CORRECT behaviour. While the bug exists the assertion
// throws, so the suite stays green; the moment the bug is fixed the test
// starts passing, jest reports that as a failure, and the fix-er flips
// `knownBug` to a plain `test` — at which point it is the regression test.
// The ID matches the finding in docs/qa/QA-REPORT.md.

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const User = require('../../Models/User');
const Role = require('../../Models/Role');
const { signToken, signRefreshToken } = require('../../utils/jwt');
const helpers = require('../helpers');

function knownBug(id, title, fn, timeout) {
  return test.failing(`[KNOWN BUG ${id}] ${title}`, fn, timeout);
}

async function createStaff(permissions = [], { roleActive = true, userOverrides = {} } = {}) {
  const suffix = helpers.uniqueSuffix();
  const role = await Role.create({ name: `QA Role ${suffix}`, permissions, isActive: roleActive });
  const staff = await User.create({
    name: 'QA Staff',
    email: `staff${suffix}@test.local`,
    role: 'staff',
    roleId: role._id,
    isActive: true,
    ...userOverrides,
  });
  const token = signToken('admin', { id: staff._id.toString(), role: 'staff' });
  return { staff, role, token };
}

// A thin supertest wrapper so a test reads as "as(buyer).post(...)".
function as(token) {
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (path) => withAuth(request(app).get(path)),
    post: (path, body = {}) => withAuth(request(app).post(path)).send(body),
    put: (path, body = {}) => withAuth(request(app).put(path)).send(body),
    patch: (path, body = {}) => withAuth(request(app).patch(path)).send(body),
    delete: (path) => withAuth(request(app).delete(path)),
  };
}

function expiredToken(aud, payload) {
  const secrets = {
    admin: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET,
    vendor: process.env.JWT_VENDOR_SECRET || process.env.JWT_SECRET,
    user: process.env.JWT_SECRET,
  };
  return jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, secrets[aud], { audience: aud });
}

// An unsigned token ("alg": "none") — the classic JWT forgery.
function unsignedToken(aud, payload) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, aud, iat: Math.floor(Date.now() / 1000) })}.`;
}

async function addToCart(token, productId, quantity = 1, extra = {}) {
  return as(token).post('/user/cart/items', { productId: String(productId), quantity, ...extra });
}

async function buyerWithAddress(overrides = {}) {
  const { user, token } = await helpers.createCustomer(overrides);
  const address = await helpers.createAddress(user._id);
  return { user, token, address };
}

function placeCod(token, addressId, extra = {}) {
  return as(token).post('/user/orders', { addressId: String(addressId), paymentMethod: 'COD', ...extra });
}

module.exports = {
  ...helpers,
  app,
  knownBug,
  createStaff,
  as,
  expiredToken,
  unsignedToken,
  signToken,
  signRefreshToken,
  addToCart,
  buyerWithAddress,
  placeCod,
};
