// The public catalog lists (categories, brands, banners) are shared for a minute, and an admin write to the
// catalog drops that cache so the storefront never lags behind an edit.
process.env.ANALYTICS_CACHE_MS = '60000';

const request = require('supertest');
const app = require('../app');
const { clearResponseCache } = require('../Middlewares/responseCache');
const { connectTestDb, disconnectTestDb, createAdmin, uniqueSuffix } = require('./helpers');

beforeAll(connectTestDb);
afterAll(async () => {
  delete process.env.ANALYTICS_CACHE_MS;
  await disconnectTestDb();
});
beforeEach(clearResponseCache);

describe('public catalog cache', () => {
  it.each(['/catalog/categories', '/catalog/brands', '/catalog/banners'])('%s is served from cache on the second request', async (path) => {
    const first = await request(app).get(path);
    const second = await request(app).get(path);
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  it('shows a new category straight away after an admin adds it', async () => {
    const { token } = await createAdmin();
    const before = await request(app).get('/catalog/categories');
    expect((await request(app).get('/catalog/categories')).headers['x-cache']).toBe('HIT');

    const name = `Cache Test ${uniqueSuffix()}`;
    const created = await request(app)
      .post('/admin/catalog/categories')
      .set('Authorization', `Bearer ${token}`)
      .field('name', name)
      .field('commissionValue', '5');
    expect(created.status).toBe(201);

    const after = await request(app).get('/catalog/categories');
    expect(after.headers['x-cache']).toBe('MISS');
    expect(JSON.stringify(after.body)).not.toEqual(JSON.stringify(before.body));
  });
});
