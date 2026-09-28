// QA audit — application-level security: injection, body limits, headers,
// CORS and error disclosure in production mode, brute-force limits, OTP
// handling. Safe payloads only.

const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../../Models/User');
const {
  connectTestDb,
  disconnectTestDb,
  createAdmin,
  createCustomer,
  createProduct,
  app,
  as,
  knownBug,
} = require('./qaHelpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('NoSQL injection', () => {
  test.each([
    ['admin login', '/admin/auth/login', { email: { $ne: null }, password: { $ne: null } }],
    ['admin login (dotted)', '/admin/auth/login', { email: { $gt: '' }, password: 'x' }],
    ['vendor login', '/vendor/auth/login', { email: { $ne: null }, password: { $ne: null } }],
    ['OTP verify', '/auth/verify-otp', { mobileNumber: { $ne: null }, otp: { $ne: null } }],
  ])('%s never authenticates an operator payload', async (_label, path, body) => {
    await createAdmin();
    const res = await request(app).post(path).send(body);
    expect(res.status).not.toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
  });

  knownBug('QA-022', 'an operator payload at admin login is a 400, not an unhandled 500', async () => {
    const res = await request(app).post('/admin/auth/login').send({ email: { $ne: null }, password: 'x' });
    expect(res.status).toBe(400);
  });

  test('operator keys in a query string are stripped (category[$ne]=x does not dump the catalogue)', async () => {
    await createProduct();
    const res = await request(app).get('/catalog/products?category[$ne]=000000000000000000000000');
    expect(res.status).toBe(200);
    // stripped to {} → treated as an impossible id filter, or ignored — never an operator
    expect(res.body.success).toBe(true);
  });

  test('regex metacharacters in public search are escaped (no ReDoS, no wildcard)', async () => {
    const res = await request(app).get(`/catalog/products?search=${encodeURIComponent('(a+)+$.*')}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('payload limits and malformed input', () => {
  test('a JSON body over 10kb is refused with 413', async () => {
    const res = await request(app).post('/auth/send-otp').send({ mobileNumber: '9'.repeat(12000) });
    expect(res.status).toBe(413);
  });

  test('malformed JSON is a 4xx, not a 500', async () => {
    const res = await request(app).post('/auth/send-otp').set('Content-Type', 'application/json').send('{"mobileNumber":');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('malformed ObjectIds are 400 on buyer order routes', async () => {
    const { token } = await createCustomer();
    for (const path of ['/user/orders/zzz', '/user/orders/zzz/tracking', '/user/orders/zzz/invoice']) {
      expect((await as(token).get(path)).status).toBe(400);
    }
  });

  test('unknown routes return the standard envelope', async () => {
    const res = await request(app).get('/definitely/not/here');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route not found' });
  });
});

describe('headers', () => {
  test('helmet security headers are present, x-powered-by is not', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('production mode: CORS and error disclosure', () => {
  let prodApp;
  beforeAll(() => {
    const saved = { ENV: process.env.ENV, ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS };
    process.env.ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://krozenda.example';
    jest.isolateModules(() => {
      prodApp = require('../../app');
    });
    process.env.ENV = saved.ENV;
    process.env.ALLOWED_ORIGINS = saved.ALLOWED_ORIGINS;
  });

  test('an allow-listed origin gets CORS headers', async () => {
    const res = await request(prodApp).get('/health').set('Origin', 'https://krozenda.example');
    expect(res.headers['access-control-allow-origin']).toBe('https://krozenda.example');
  });

  test('a foreign origin gets no CORS grant', async () => {
    const res = await request(prodApp).get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  knownBug('QA-023', 'a foreign origin is refused with 403, not reported as a 500 server error', async () => {
    const res = await request(prodApp).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });

  test('an unhandled 500 in production says nothing about the internals', async () => {
    const res = await request(prodApp).post('/admin/auth/login').send({ email: { $ne: null }, password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Something went wrong');
    expect(JSON.stringify(res.body)).not.toMatch(/stack|TypeError|at .*\.js|Mongo/);
  });
});

describe('brute force and OTP handling', () => {
  knownBug('QA-010', 'repeated failed admin logins are throttled (429) or locked', async () => {
    const email = `bf${Date.now()}@test.local`;
    await User.create({ name: 'BF', email, role: 'admin', isActive: true, password: await bcrypt.hash('Correct#123', 10) });
    const statuses = [];
    for (let i = 0; i < 25; i += 1) {
      statuses.push((await request(app).post('/admin/auth/login').send({ email, password: `wrong${i}` })).status);
    }
    expect(statuses).toContain(429);
  }, 60000);

  knownBug('QA-011', 'requesting a new OTP straight away is throttled — the 5-guess cap must not reset on demand', async () => {
    const mobileNumber = '9222200011';
    const first = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(first.status).toBe(200);
    for (let i = 0; i < 5; i += 1) await request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '000000' });
    const again = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(again.status).toBe(429);
  });

  knownBug('QA-013', 'the one-time password is never written to the server log', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const res = await request(app).post('/auth/send-otp').send({ mobileNumber: '9222200012' });
      const otp = res.body.data?.otp || '123456';
      const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).not.toContain(otp);
    } finally {
      spy.mockRestore();
    }
  });
});
