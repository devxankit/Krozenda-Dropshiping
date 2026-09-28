// QA audit — authentication and role-based access.
//
// Every audience (buyer / seller / admin / staff) against every other
// audience's surface, forged and expired tokens, and — the part that found
// real defects — a sub-admin whose role grants ONE unrelated module
// (support tickets) probing the admin routers that never check a permission.

jest.mock('../../Config/razorpay', () => ({
  orders: { create: jest.fn() },
  payments: { fetch: jest.fn(), refund: jest.fn() },
}));

const Coupon = require('../../Models/Coupon');
const PlatformSettings = require('../../Models/PlatformSettings');
const VendorPayout = require('../../Models/VendorPayout');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCustomer,
  createVendor,
  createStaff,
  as,
  knownBug,
  expiredToken,
  unsignedToken,
  signToken,
  signRefreshToken,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('token handling', () => {
  test('no token → 401 on every audience', async () => {
    for (const path of ['/admin/orders', '/vendor/orders', '/user/orders', '/fcm-token']) {
      const res = path === '/fcm-token' ? await as(null).post(path) : await as(null).get(path);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  test('malformed and garbage tokens → 401', async () => {
    for (const bad of ['x', 'Bearer', 'a.b.c', '{"$ne":null}']) {
      const res = await as(bad).get('/user/orders');
      expect(res.status).toBe(401);
    }
  });

  test('alg:none forgery is rejected for every audience', async () => {
    const { admin } = await createAdmin();
    const { user } = await createCustomer();
    const { vendor } = await createVendor({ verificationStatus: 'APPROVED' });
    expect((await as(unsignedToken('admin', { id: String(admin._id) })).get('/admin/orders')).status).toBe(401);
    expect((await as(unsignedToken('user', { id: String(user._id) })).get('/user/orders')).status).toBe(401);
    expect((await as(unsignedToken('vendor', { id: String(vendor._id) })).get('/vendor/orders')).status).toBe(401);
  });

  test('expired buyer token → 401 with TOKEN_EXPIRED so the client refreshes', async () => {
    const { user } = await createCustomer();
    const res = await as(expiredToken('user', { id: String(user._id) })).get('/user/orders');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('expired admin/vendor tokens → 401', async () => {
    const { admin } = await createAdmin();
    const { vendor } = await createVendor({ verificationStatus: 'APPROVED' });
    expect((await as(expiredToken('admin', { id: String(admin._id) })).get('/admin/orders')).status).toBe(401);
    expect((await as(expiredToken('vendor', { id: String(vendor._id) })).get('/vendor/orders')).status).toBe(401);
  });

  test('a buyer refresh token is not a bearer credential on buyer routes', async () => {
    const { user } = await createCustomer();
    const refresh = signRefreshToken('user', { id: String(user._id) });
    expect((await as(refresh).get('/user/orders')).status).toBe(401);
  });

  knownBug('QA-019', 'a 30-day buyer refresh token must not authenticate /fcm-token (protectAnyAccount skips the typ check)', async () => {
    const { user } = await createCustomer();
    const refresh = signRefreshToken('user', { id: String(user._id) });
    const res = await as(refresh).post('/fcm-token', { token: 'qa-device-token', deviceType: 'web' });
    expect(res.status).toBe(401);
  });
});

describe('cross-audience isolation', () => {
  test('buyer token cannot reach admin or vendor APIs', async () => {
    const { token } = await createCustomer();
    expect((await as(token).get('/admin/orders')).status).toBe(401);
    expect((await as(token).get('/admin/customers')).status).toBe(401);
    expect((await as(token).get('/vendor/orders')).status).toBe(401);
    expect((await as(token).get('/vendor/products')).status).toBe(401);
  });

  test('vendor token cannot reach admin or buyer APIs', async () => {
    const { token } = await createVendor({ verificationStatus: 'APPROVED' });
    expect((await as(token).get('/admin/orders')).status).toBe(401);
    expect((await as(token).get('/admin/vendors')).status).toBe(401);
    expect((await as(token).get('/user/orders')).status).toBe(401);
  });

  test('admin token cannot act as a buyer or a vendor', async () => {
    const { token } = await createAdmin();
    expect((await as(token).get('/user/orders')).status).toBe(401);
    expect((await as(token).get('/vendor/orders')).status).toBe(401);
  });

  test('a token whose id is a buyer but signed as vendor is rejected', async () => {
    const { user } = await createCustomer();
    const token = signToken('vendor', { id: String(user._id) });
    expect((await as(token).get('/vendor/orders')).status).toBe(401);
  });
});

describe('account state', () => {
  test('deactivated admin → 403, deleted admin → 401', async () => {
    const { token: t1 } = await createAdmin({ isActive: false });
    expect((await as(t1).get('/admin/orders')).status).toBe(403);
    const { token: t2 } = await createAdmin({ isDeleted: true });
    expect((await as(t2).get('/admin/orders')).status).toBe(401);
  });

  test('deactivated buyer → 403, deleted buyer → 401', async () => {
    const { token: t1 } = await createCustomer({ isActive: false });
    expect((await as(t1).get('/user/orders')).status).toBe(403);
    const { token: t2 } = await createCustomer({ isDeleted: true });
    expect((await as(t2).get('/user/orders')).status).toBe(401);
  });

  test('suspended (approved + inactive) vendor → 403 immediately', async () => {
    const { token } = await createVendor({ verificationStatus: 'APPROVED', isActive: false });
    expect((await as(token).get('/vendor/orders')).status).toBe(403);
  });
});

describe('sub-admin (staff) permissions', () => {
  let supportStaff;
  beforeAll(async () => {
    // Can work support tickets and nothing else.
    supportStaff = await createStaff(['admin.people.support']);
  });

  test('positive control: the granted module works', async () => {
    const res = await as(supportStaff.token).get('/admin/support/tickets');
    expect(res.status).toBe(200);
  });

  test.each([
    ['GET', '/admin/orders'],
    ['GET', '/admin/staff'],
    ['GET', '/admin/roles'],
    ['GET', '/admin/system/backups'],
    ['GET', '/admin/catalog/products'],
    ['GET', '/admin/customers'],
    ['GET', '/admin/vendors'],
    ['GET', '/admin/accounting/overview'],
    ['GET', '/admin/finance/overview'],
    ['GET', '/admin/dashboard'],
    ['GET', '/admin/payments/settings'],
    ['GET', '/admin/marketing/banners'],
  ])('denied: %s %s', async (method, path) => {
    const res = await as(supportStaff.token)[method.toLowerCase()](path);
    expect(res.status).toBe(403);
  });

  test('staff can never create another staff account or role', async () => {
    const r1 = await as(supportStaff.token).post('/admin/staff', { name: 'x', email: 'x@y.z', password: 'Password@123' });
    const r2 = await as(supportStaff.token).post('/admin/roles', { name: 'root', permissions: ['admin.orders.view'] });
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
  });

  knownBug('QA-001a', 'support-only staff must not be able to create a 100%-off coupon', async () => {
    const code = `QA100${Date.now()}`;
    const res = await as(supportStaff.token).post('/admin/marketing/coupons', {
      code,
      discountType: 'PERCENTAGE',
      discountValue: 100,
      applicableTo: 'ALL',
      startDate: new Date(Date.now() - 1000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
    });
    const created = await Coupon.findOne({ code: code.toUpperCase() });
    expect(res.status).toBe(403);
    expect(created).toBeNull();
  });

  knownBug('QA-001b', 'support-only staff must not be able to change commission, GST and buyer platform fee', async () => {
    const before = await PlatformSettings.getSettings();
    const res = await as(supportStaff.token).put('/admin/settings/general', {
      buyerPlatformFeeType: 'flat',
      buyerPlatformFeeValue: 0,
      defaultCommissionPercent: 0,
    });
    const after = await PlatformSettings.getSettings();
    expect(res.status).toBe(403);
    expect(after.defaultCommissionPercent).toBe(before.defaultCommissionPercent);
  });

  knownBug('QA-001c', 'support-only staff must not be able to record a vendor payout (reduces what the seller is owed)', async () => {
    const { vendor } = await createVendor({ verificationStatus: 'APPROVED' });
    const res = await as(supportStaff.token).post('/admin/accounts/payouts', {
      vendor: String(vendor._id),
      amount: 50000,
      method: 'OTHER',
      note: 'qa probe',
    });
    expect(res.status).toBe(403);
    expect(await VendorPayout.countDocuments({ vendor: vendor._id })).toBe(0);
  });

  knownBug('QA-001d', 'support-only staff must not search customer PII via the coupon WhatsApp picker', async () => {
    await createCustomer({ name: 'Pii Target' });
    const res = await as(supportStaff.token).get('/admin/marketing/coupons/whatsapp/customers?search=Pii');
    expect(res.status).toBe(403);
  });

  knownBug('QA-001e', 'support-only staff must not publish CMS pages (terms/privacy the buyer accepts)', async () => {
    const res = await as(supportStaff.token).post('/admin/marketing/cms', {
      title: `QA Terms ${Date.now()}`,
      content: '<p>changed</p>',
    });
    expect(res.status).toBe(403);
  });

  knownBug('QA-001f', 'support-only staff must not create FAQs', async () => {
    const res = await as(supportStaff.token).post('/admin/marketing/faqs', { question: 'q?', answer: 'a' });
    expect(res.status).toBe(403);
  });

  knownBug('QA-001g', 'support-only staff must not read the accounts ledger', async () => {
    const res = await as(supportStaff.token).get('/admin/accounts/ledger');
    expect(res.status).toBe(403);
  });

  knownBug('QA-020', 'a DEACTIVATED role must stop granting its permissions', async () => {
    const { token } = await createStaff(['admin.people.support'], { roleActive: false });
    const res = await as(token).get('/admin/support/tickets');
    expect(res.status).toBe(403);
  });
});
