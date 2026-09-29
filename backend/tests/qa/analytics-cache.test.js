// QA-014 (perf): admin dashboard/analytics are coalesced and briefly cached.
// Load test before: 10 admins → 1 req/s, 65% timeouts, each running the same
// line-level $lookup pipelines side by side.

process.env.ANALYTICS_CACHE_MS = '60000';

const Order = require('../../Models/Order');
const { clearResponseCache } = require('../../Middlewares/responseCache');
const { connectTestDb, disconnectTestDb, createAdmin, createStaff, as } = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(async () => {
  delete process.env.ANALYTICS_CACHE_MS;
  await disconnectTestDb();
});
beforeEach(clearResponseCache);

test('parallel identical dashboard requests run the aggregation once', async () => {
  const { token } = await createAdmin();
  const spy = jest.spyOn(Order, 'aggregate');
  await as(token).get('/admin/dashboard'); // warm-up to learn the count of one run
  const perRun = spy.mock.calls.length;
  clearResponseCache();
  spy.mockClear();

  const results = await Promise.all(Array.from({ length: 8 }, () => as(token).get('/admin/dashboard')));
  expect(results.every((r) => r.status === 200)).toBe(true);
  expect(spy.mock.calls.length).toBe(perRun);
  const tags = results.map((r) => r.headers['x-cache']).sort();
  expect(tags.filter((t) => t === 'MISS')).toHaveLength(1);
  // everyone got the same numbers
  expect(new Set(results.map((r) => JSON.stringify(r.body))).size).toBe(1);
  spy.mockRestore();
});

test('a repeat within the TTL is served from cache', async () => {
  const { token } = await createAdmin();
  expect((await as(token).get('/admin/analytics/sales')).headers['x-cache']).toBe('MISS');
  expect((await as(token).get('/admin/analytics/sales')).headers['x-cache']).toBe('HIT');
});

test('different query strings are different entries', async () => {
  const { token } = await createAdmin();
  await as(token).get('/admin/analytics/sales?range=7d');
  expect((await as(token).get('/admin/analytics/sales?range=30d')).headers['x-cache']).toBe('MISS');
});

test('the cache never bypasses the permission check', async () => {
  const { token } = await createAdmin();
  await as(token).get('/admin/dashboard'); // cached now
  const staff = await createStaff(['admin.people.support']);
  expect((await as(staff.token).get('/admin/dashboard')).status).toBe(403);
  expect((await as(null).get('/admin/dashboard')).status).toBe(401);
});
