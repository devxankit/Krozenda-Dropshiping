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

  test('QA-022 (regression): an operator payload at admin login is a 400, not an unhandled 500', async () => {
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
  describe('QA-010 (regression): password sign-in is throttled per account', () => {
    const LoginThrottle = require('../../Models/LoginThrottle');
    async function adminWithPassword(password = 'Correct#123') {
      const email = `bf${Date.now()}${Math.floor(Math.random() * 1e6)}@test.local`;
      await User.create({ name: 'BF', email, role: 'admin', isActive: true, password: await bcrypt.hash(password, 10) });
      return email;
    }
    const login = (email, password) => request(app).post('/admin/auth/login').send({ email, password });

    test('5 wrong passwords, then 429 with Retry-After — and the right password is refused while locked', async () => {
      const email = await adminWithPassword();
      const statuses = [];
      for (let i = 0; i < 7; i += 1) statuses.push((await login(email, `wrong${i}`)).status);
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
      const locked = await login(email, 'Correct#123');
      expect(locked.status).toBe(429);
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    }, 60000);

    test('a parallel burst of 30 guesses is held to 5 password checks', async () => {
      const email = await adminWithPassword();
      const results = await Promise.all(Array.from({ length: 30 }, (_, i) => login(email, `burst${i}`)));
      expect(results.filter((r) => r.status === 401)).toHaveLength(5);
      expect(results.filter((r) => r.status === 429)).toHaveLength(25);
    }, 60000);

    test('a successful sign-in clears the count', async () => {
      const email = await adminWithPassword();
      for (let i = 0; i < 4; i += 1) await login(email, 'nope');
      expect((await login(email, 'Correct#123')).status).toBe(200);
      for (let i = 0; i < 4; i += 1) expect((await login(email, 'nope')).status).toBe(401);
    }, 60000);

    test('an unknown email is throttled the same way (no account enumeration)', async () => {
      const statuses = [];
      for (let i = 0; i < 6; i += 1) statuses.push((await login('ghost@test.local', 'x')).status);
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    }, 60000);

    test('the lock expires with its window', async () => {
      const email = await adminWithPassword();
      for (let i = 0; i < 6; i += 1) await login(email, 'nope');
      await LoginThrottle.updateOne(
        { key: `admin:${email}` },
        { $set: { lockedUntil: new Date(Date.now() - 1000), windowStartedAt: new Date(Date.now() - 16 * 60000) } }
      );
      expect((await login(email, 'Correct#123')).status).toBe(200);
    }, 60000);

    test('seller login is throttled too, independently of admin', async () => {
      const { createVendor } = require('./qaHelpers');
      const { vendor } = await createVendor({ verificationStatus: 'APPROVED' });
      const statuses = [];
      for (let i = 0; i < 6; i += 1) {
        statuses.push((await request(app).post('/vendor/auth/login').send({ email: vendor.email, password: 'nope' })).status);
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
      expect((await request(app).post('/vendor/auth/login').send({ email: vendor.email, password: 'secret123' })).status).toBe(429);
    }, 60000);
  });

  test('QA-011 (regression): a new OTP straight after the last one is refused (30s cooldown)', async () => {
    const mobileNumber = '9222200011';
    const first = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(first.status).toBe(200);
    for (let i = 0; i < 5; i += 1) await request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '000000' });
    const again = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(again.status).toBe(429);
    expect(again.body.code).toBe('OTP_RESEND_COOLDOWN');
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('QA-011: parallel resends cannot slip past the cooldown', async () => {
    const mobileNumber = '9222200013';
    const results = await Promise.all(Array.from({ length: 6 }, () => request(app).post('/auth/send-otp').send({ mobileNumber })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  test('QA-011: at most 5 codes per number per hour', async () => {
    const OtpRequest = require('../../Models/OtpRequest');
    const mobileNumber = '9222200014';
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      // step past the 30s cooldown without waiting for it
      await OtpRequest.updateOne({ mobileNumber }, { $set: { lastSentAt: new Date(Date.now() - 60000) } });
      statuses.push((await request(app).post('/auth/send-otp').send({ mobileNumber })).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  test('QA-011: 20 parallel wrong guesses still lock the code after 5', async () => {
    const OtpRequest = require('../../Models/OtpRequest');
    const mobileNumber = '9222200015';
    await request(app).post('/auth/send-otp').send({ mobileNumber });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '000000' }))
    );
    expect(results.filter((r) => r.status === 400)).toHaveLength(5);
    expect((await OtpRequest.findOne({ mobileNumber })).otpHash).toBeNull();
  });

  test('bypass (reviewer) numbers are not rate-limited', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).post('/auth/send-otp').send({ mobileNumber: '1111111111' })).status).toBe(200);
    }
  });

  test('a correct code still signs in, and only once', async () => {
    const mobileNumber = '9222200016';
    await request(app).post('/auth/send-otp').send({ mobileNumber });
    const [a, b] = await Promise.all([
      request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '123456' }),
      request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '123456' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  test('QA-013 (regression): in production the one-time password is never written to the server log', async () => {
    // isProduction is fixed at module load, so the controller is loaded on
    // its own under ENV=production, bound to the models this test DB already
    // has, and its handler called directly.
    const Customer = require('../../Models/Customer');
    const OtpRequest = require('../../Models/OtpRequest');
    const Translation = require('../../Models/Translation');
    let controller;
    let sentOtp = null;
    const saved = process.env.ENV;
    process.env.ENV = 'production';
    jest.isolateModules(() => {
      jest.doMock('../../Models/Customer', () => Customer);
      jest.doMock('../../Models/OtpRequest', () => OtpRequest);
      jest.doMock('../../Models/Translation', () => Translation);
      jest.doMock('../../utils/smsService', () => ({
        sendOtpSms: jest.fn(async (number, otp) => {
          sentOtp = otp;
        }),
      }));
      controller = require('../../Controllers/userAuthController');
    });
    process.env.ENV = saved;

    const res = { statusCode: 200, body: null, headers: {} };
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (body) => ((res.body = body), res);
    res.set = (k, v) => ((res.headers[k] = v), res);

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await controller.requestOtp({ body: { mobileNumber: '9222200012' } }, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.otp).toBeUndefined();
      expect(sentOtp).toMatch(/^\d{6}$/);
      const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).not.toContain(sentOtp);
      expect(logged).not.toContain('9222200012');
    } finally {
      spy.mockRestore();
    }
  });
});
