// Settings → Business rules (backed by /admin/accounting/config) and the
// admin's own profile (/admin/auth/me, /profile, /change-password).

const { connectTestDb, disconnectTestDb, createAdmin, createStaff, uniqueSuffix, as } = require('./qaHelpers');
const request = require('supertest');
const app = require('../../app');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('business rules', () => {
  test('the config carries the real, enforced policy plus the return window', async () => {
    const { token } = await createAdmin();
    const res = await as(token).get('/admin/accounting/config');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      maxCommissionPercent: expect.any(Number),
      settlementHoldDays: expect.any(Number),
      sellerSettlementMode: expect.stringMatching(/AUTO|MANUAL/),
      returnWindowDays: 7,
    });
  });

  test('an admin saves a rule; bad values are refused', async () => {
    const { token } = await createAdmin();
    const saved = await as(token).patch('/admin/accounting/config', { settlementHoldDays: 10, sellerSettlementMode: 'MANUAL' });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ settlementHoldDays: 10, sellerSettlementMode: 'MANUAL' });

    expect((await as(token).patch('/admin/accounting/config', { settlementHoldDays: 500 })).status).toBe(400);
    expect((await as(token).patch('/admin/accounting/config', { gatewayFeeBearer: 'BUYER' })).status).toBe(400);
    await as(token).patch('/admin/accounting/config', { settlementHoldDays: 7, sellerSettlementMode: 'AUTO' });
  });

  test('reading needs accounting view; saving needs commission manage', async () => {
    const { token: settingsOnly } = await createStaff(['admin.access', 'admin.settings.view']);
    const { token: viewer } = await createStaff(['admin.access', 'admin.accounting.view']);
    expect((await as(settingsOnly).get('/admin/accounting/config')).status).toBe(403);
    expect((await as(viewer).get('/admin/accounting/config')).status).toBe(200);
    expect((await as(viewer).patch('/admin/accounting/config', { settlementHoldDays: 9 })).status).toBe(403);
  });
});

describe('my profile', () => {
  test('me returns the account without its password', async () => {
    const { admin, token } = await createAdmin({ name: 'Profile Person' });
    const res = await as(token).get('/admin/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.admin).toMatchObject({ name: 'Profile Person', email: admin.email });
    expect(JSON.stringify(res.body)).not.toMatch(/"password"/);
  });

  test('changing the password needs the current one', async () => {
    const email = `pw${uniqueSuffix()}@test.local`;
    const { token } = await createAdmin({ email, password: 'Old#Pass123' });
    const change = (body) => as(token).put('/admin/auth/change-password', body);

    const missing = await change({ newPassword: 'New#Pass456', confirmPassword: 'New#Pass456' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('Enter your current password');

    const wrong = await change({ currentPassword: 'nope', newPassword: 'New#Pass456', confirmPassword: 'New#Pass456' });
    expect(wrong.status).toBe(400);

    const ok = await change({ currentPassword: 'Old#Pass123', newPassword: 'New#Pass456', confirmPassword: 'New#Pass456' });
    expect(ok.status).toBe(200);
    const login = await request(app).post('/admin/auth/login').send({ email, password: 'New#Pass456' });
    expect(login.status).toBe(200);
  });

  test('guessing the current password is throttled like sign-in', async () => {
    const email = `guess${uniqueSuffix()}@test.local`;
    const { token } = await createAdmin({ email, password: 'Real#Pass123' });
    const guess = () =>
      as(token).put('/admin/auth/change-password', { currentPassword: 'guess', newPassword: 'New#Pass456', confirmPassword: 'New#Pass456' });
    const statuses = [];
    for (let i = 0; i < 7; i += 1) statuses.push((await guess()).status);
    expect(statuses).toContain(429);
  });
});
