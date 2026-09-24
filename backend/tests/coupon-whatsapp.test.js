const request = require('supertest');
const app = require('../app');
const Coupon = require('../Models/Coupon');
const Customer = require('../Models/Customer');
const Order = require('../Models/Order');
const CouponWhatsappLog = require('../Models/CouponWhatsappLog');
const { couponParams } = require('../services/couponWhatsappService');
const { connectTestDb, disconnectTestDb, createCustomer, createAdmin } = require('./helpers');

// The gateway is never reached: fetch is replaced for the whole file, and the
// env is switched to a non-test ENV only so the service agrees to "send".
const realFetch = global.fetch;
const savedEnv = { ...process.env };
let sent;
let failPhones;
let adminToken;

beforeAll(async () => {
  await connectTestDb();
  Object.assign(process.env, {
    ENV: 'production',
    WHATSAPP_ENABLED: 'true',
    WHATSAPP_USER: 'u',
    WHATSAPP_PASS: 'p',
    WHATSAPP_SENDER: 'BUZWAP',
    WHATSAPP_TEMPLATE_COUPON: 'coupon_offer',
  });
  global.fetch = jest.fn(async (url) => {
    const params = new URL(url).searchParams;
    if (failPhones.has(params.get('phone'))) {
      return { ok: true, status: 200, text: async () => 'Template not approved' };
    }
    sent.push(params);
    return { ok: true, status: 200, text: async () => `S.${sent.length}` };
  });
  ({ token: adminToken } = await createAdmin());
});

beforeEach(async () => {
  sent = [];
  failPhones = new Set();
  // Every test starts from its own customers so "all" is predictable.
  await Customer.updateMany({}, { $set: { isActive: false } });
});

afterAll(async () => {
  global.fetch = realFetch;
  process.env = savedEnv;
  await disconnectTestDb();
});

function makeCoupon(overrides = {}) {
  return Coupon.create({
    code: `WA${Date.now()}${Math.floor(Math.random() * 1000)}`,
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 200,
    minOrderAmount: 499,
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date('2026-12-31T12:00:00Z'),
    ...overrides,
  });
}

const send = (coupon, body) =>
  request(app)
    .post(`/admin/marketing/coupons/${coupon._id}/whatsapp`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send(body);

async function settle(couponId, count) {
  for (let i = 0; i < 250; i += 1) {
    const done = await CouponWhatsappLog.countDocuments({ couponId, status: { $ne: 'SENDING' } });
    if (done >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('coupon offers over WhatsApp', () => {
  test('params follow the coupon_offer {{1}}..{{5}} order', async () => {
    const coupon = await makeCoupon();
    expect(couponParams(coupon, { name: 'Rehan Multani' })).toEqual([
      'Rehan',
      coupon.code,
      '20% off (up to Rs.200)',
      'Rs.499',
      '31-12-2026',
    ]);

    const flat = await makeCoupon({ discountType: 'FIXED', discountValue: 100, maxDiscountAmount: null, minOrderAmount: 0, applicableTo: 'CATEGORIES' });
    expect(couponParams(flat, { name: '' }).slice(2, 4)).toEqual(['Rs.100 off on selected items', 'no minimum']);
  });

  test('specific customers get it once, even when sent twice', async () => {
    const coupon = await makeCoupon();
    const { user: a } = await createCustomer({ name: 'Asha Rao', mobileNumber: '9876500001' });
    const { user: b } = await createCustomer({ mobileNumber: '9876500002' });

    const first = await send(coupon, { audience: 'specific', customerIds: [a._id, b._id] });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ sent: 2, failed: 0, alreadySent: 0 });
    expect(sent.map((p) => p.get('text'))).toEqual(['coupon_offer', 'coupon_offer']);
    expect(sent.find((p) => p.get('phone') === '9876500001').get('Params')).toBe(
      `Asha,${coupon.code},20% off (up to Rs.200),Rs.499,31-12-2026`
    );

    const again = await send(coupon, { audience: 'specific', customerIds: [a._id] });
    expect(again.body.data).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(sent).toHaveLength(2);
  });

  test('a failed send is recorded and retried next time', async () => {
    const coupon = await makeCoupon();
    const { user } = await createCustomer({ mobileNumber: '9876500003' });
    failPhones.add('9876500003');

    const first = await send(coupon, { audience: 'specific', customerIds: [user._id] });
    expect(first.body.data).toMatchObject({ sent: 0, failed: 1 });
    const row = await CouponWhatsappLog.findOne({ couponId: coupon._id }).lean();
    expect(row.error).toMatch(/Template not approved/);

    failPhones.clear();
    const retry = await send(coupon, { audience: 'specific', customerIds: [user._id] });
    expect(retry.body.data).toMatchObject({ sent: 1 });
  });

  test('"all" only reaches customers the coupon is valid for', async () => {
    const coupon = await makeCoupon({ customerEligibility: 'NEW' });
    const { user: fresh } = await createCustomer({ mobileNumber: '9876500004' });
    const { user: buyer } = await createCustomer({ mobileNumber: '9876500005' });
    await createCustomer({ mobileNumber: '12345' });
    await Order.collection.insertOne({ user: buyer._id, status: 'DELIVERED', items: [], createdAt: new Date() });

    const res = await send(coupon, { audience: 'all' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ recipients: 1, ineligible: 1, noPhone: 1, queued: true });

    await settle(coupon._id, 1);
    expect(sent.map((p) => p.get('phone'))).toEqual(['9876500004']);
    expect(await CouponWhatsappLog.findOne({ customerId: fresh._id }).lean()).toMatchObject({ status: 'SENT' });

    const stats = await request(app)
      .get(`/admin/marketing/coupons/${coupon._id}/whatsapp`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stats.body.data).toMatchObject({ sent: 1, failed: 0, blockedReason: null });
  });

  test('refuses expired coupons and a missing template', async () => {
    const expired = await makeCoupon({ startDate: new Date('2025-01-01'), endDate: new Date('2025-02-01') });
    const { user } = await createCustomer({ mobileNumber: '9876500006' });
    const res = await send(expired, { audience: 'specific', customerIds: [user._id] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/);

    process.env.WHATSAPP_TEMPLATE_COUPON = '';
    try {
      const live = await makeCoupon();
      const noTemplate = await send(live, { audience: 'all' });
      expect(noTemplate.status).toBe(400);
      expect(noTemplate.body.message).toMatch(/WHATSAPP_TEMPLATE_COUPON/);
    } finally {
      process.env.WHATSAPP_TEMPLATE_COUPON = 'coupon_offer';
    }
    expect(sent).toHaveLength(0);
  });
});
