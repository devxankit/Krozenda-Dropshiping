const request = require('supertest');
const app = require('../app');
const { connectTestDb, disconnectTestDb, uniqueSuffix } = require('./helpers');
const { signToken } = require('../utils/jwt');
const User = require('../Models/User');
const Role = require('../Models/Role');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

async function createStaff(permissions) {
  const role = await Role.create({ name: `Test Role ${uniqueSuffix()}`, permissions, isActive: true });
  const staff = await User.create({
    name: 'Test Staff',
    email: `staff${uniqueSuffix()}@test.local`,
    role: 'staff',
    roleId: role._id,
    isActive: true,
  });
  const token = signToken('admin', { id: staff._id.toString(), role: 'staff', permissions });
  return token;
}

describe('catalog route permission gating (regression)', () => {
  it('a staff account with zero permissions cannot create a product', async () => {
    const token = await createStaff([]);
    const res = await request(app)
      .post('/admin/catalog/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Should Not Be Created')
      .field('price', '100')
      .field('category', '000000000000000000000000');
    expect(res.status).toBe(403);
  });

  it('a staff account WITH admin.catalog.products can create a product', async () => {
    const token = await createStaff(['admin.catalog.products']);
    const res = await request(app).get('/admin/catalog/products').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('a staff account with zero permissions cannot broadcast a marketing campaign', async () => {
    const token = await createStaff([]);
    const res = await request(app)
      .post('/admin/marketing/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Spam', message: 'hi' });
    expect(res.status).toBe(403);
  });
});
