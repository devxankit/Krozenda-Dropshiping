const request = require('supertest');
const app = require('../app');
const AdminAuditLog = require('../Models/AdminAuditLog');
const User = require('../Models/User');
const { signToken } = require('../utils/jwt');
const { describeRoute } = require('../Middlewares/adminAudit');
const { connectTestDb, disconnectTestDb, createAdmin } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

// The middleware writes on 'finish', after the response has gone out, so the
// row can land a moment after supertest resolves.
async function waitForLog(filter) {
  for (let i = 0; i < 40; i += 1) {
    const row = await AdminAuditLog.findOne(filter).sort({ createdAt: -1 }).lean();
    if (row) return row;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe('describeRoute', () => {
  it('names the action, entity and id from the path', () => {
    expect(describeRoute('PATCH', '/admin/orders/66f0c0ffee0000000000abcd/status')).toMatchObject({
      action: 'orders.status.update',
      entityId: '66f0c0ffee0000000000abcd',
    });
    expect(describeRoute('POST', '/admin/catalog/products').action).toBe('catalog.products.create');
    expect(describeRoute('POST', '/admin/orders/KZ-40101-A/cancel').action).toBe('orders.cancel');
    expect(describeRoute('DELETE', '/admin/staff/66f0c0ffee0000000000abcd').description).toMatch(/^Deleted Staff/);
  });
});

describe('admin audit log', () => {
  it('records a successful sign-in against the account, without the password', async () => {
    const { admin } = await createAdmin({ password: 'Secret#123' });
    const res = await request(app).post('/admin/auth/login').send({ email: admin.email, password: 'Secret#123' });
    expect(res.status).toBe(200);

    const row = await waitForLog({ actorId: admin._id, action: 'auth.login' });
    expect(row).toBeTruthy();
    expect(row.actorName).toBe('Test Admin');
    expect(row.actorRole).toBe('Super Admin');
    expect(row.success).toBe(true);
    expect(row.changes).toBeNull();
  });

  it('records a failed sign-in as critical, under the attempted email', async () => {
    const email = `nobody${Date.now()}@test.local`;
    await request(app).post('/admin/auth/login').send({ email, password: 'wrong' });

    const row = await waitForLog({ actorEmail: email });
    expect(row).toMatchObject({ action: 'auth.login.fail', severity: 'critical', success: false, statusCode: 401 });
  });

  it('records a write with who did it and redacts secrets from the payload', async () => {
    const { admin, token } = await createAdmin({ password: 'Secret#123' });
    await request(app)
      .put('/admin/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'Secret#123', newPassword: 'Newer#4567' });

    const row = await waitForLog({ actorId: admin._id, action: /change-password/ });
    expect(row).toBeTruthy();
    expect(row.method).toBe('PUT');
    expect(row.changes).not.toMatch(/Secret#123|Newer#4567/);
  });

  it('ignores reads and anonymous writes', async () => {
    const before = await AdminAuditLog.countDocuments();
    const { token } = await createAdmin();
    await request(app).get('/admin/auth/me').set('Authorization', `Bearer ${token}`);
    await request(app).post('/admin/catalog/products').send({ name: 'x' });
    await new Promise((r) => setTimeout(r, 150));
    expect(await AdminAuditLog.countDocuments()).toBe(before);
  });

  it('lists entries to an admin, newest first, with tab counts', async () => {
    const { token } = await createAdmin();
    const res = await request(app).get('/admin/system/audit-logs?tab=all&rowsPerPage=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.tabCounts).toHaveProperty('critical');
    const [first, second] = res.body.data.items;
    if (second) expect(new Date(first.createdAt) >= new Date(second.createdAt)).toBe(true);
  });

  it('refuses staff without admin.audit.view', async () => {
    const staff = await User.create({ name: 'Staff', email: `staff${Date.now()}@test.local`, role: 'staff', isActive: true });
    const token = signToken('admin', { id: staff._id.toString(), role: 'staff', permissions: [] });
    const res = await request(app).get('/admin/system/audit-logs').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('is append-only', async () => {
    const row = await AdminAuditLog.findOne();
    await expect(AdminAuditLog.updateOne({ _id: row._id }, { actorName: 'forged' })).rejects.toThrow(/append-only/);
    await expect(AdminAuditLog.deleteOne({ _id: row._id })).rejects.toThrow(/append-only/);
  });
});
