// Admin-authored tutorials: admin manages them, sellers and customers read
// only the published ones meant for their own audience.
const request = require('supertest');
const app = require('../app');
const Tutorial = require('../Models/Tutorial');
const { connectTestDb, disconnectTestDb, createAdmin } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('tutorials', () => {
  let auth;
  beforeAll(async () => {
    await Tutorial.deleteMany({});
    const { token } = await createAdmin();
    auth = { Authorization: `Bearer ${token}` };
  });

  const create = (body) => request(app).post('/admin/marketing/tutorials').set(auth).send(body);

  it('rejects a tutorial with no audience, no content or a non-http link', async () => {
    expect((await create({ title: 'x', description: 'steps' })).status).toBe(400);
    expect((await create({ title: 'x', audience: 'seller' })).status).toBe(400);
    const bad = await create({ title: 'x', audience: 'seller', videoUrl: 'javascript:alert(1)' });
    expect(bad.status).toBe(400);
  });

  it('requires admin auth to manage', async () => {
    const res = await request(app).post('/admin/marketing/tutorials').send({ title: 'x', audience: 'seller', description: 'y' });
    expect(res.status).toBe(401);
  });

  it('shows each audience only its own published tutorials', async () => {
    await create({ title: 'List a product', audience: 'seller', description: 'Step 1', videoUrl: 'https://youtu.be/abc', order: 1 });
    await create({ title: 'Hidden draft', audience: 'seller', description: 'wip', status: 'draft' });
    await create({ title: 'How to buy', audience: 'customer', description: 'Add to cart' });

    const seller = await request(app).get('/tutorials?audience=seller');
    expect(seller.body.data.items.map((t) => t.title)).toEqual(['List a product']);

    const customer = await request(app).get('/tutorials?audience=customer');
    expect(customer.body.data.items.map((t) => t.title)).toEqual(['How to buy']);

    expect((await request(app).get('/tutorials')).status).toBe(400);
  });

  it('publishing a draft and deleting take effect on the public list', async () => {
    const list = await request(app).get('/admin/marketing/tutorials?tab=draft').set(auth);
    const draft = list.body.data.items[0];
    await request(app).patch(`/admin/marketing/tutorials/${draft.id}/status`).set(auth).send({ status: 'published' });
    let seller = await request(app).get('/tutorials?audience=seller');
    expect(seller.body.data.items).toHaveLength(2);

    await request(app).delete(`/admin/marketing/tutorials/${draft.id}`).set(auth);
    seller = await request(app).get('/tutorials?audience=seller');
    expect(seller.body.data.items).toHaveLength(1);
  });
});
