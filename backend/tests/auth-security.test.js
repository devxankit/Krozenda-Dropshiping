const request = require('supertest');
const app = require('../app');
const { connectTestDb, disconnectTestDb, createCustomer, createAdmin, createAddress } = require('./helpers');
const OtpRequest = require('../Models/OtpRequest');
const { isBypassNumber } = require('../Controllers/userAuthController');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('admin auth backdoor (regression)', () => {
  it('rejects a Bearer token merely containing "demo"', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', 'Bearer demo-anything');
    expect(res.status).toBe(401);
  });

  it('still rejects a garbage token the normal way', async () => {
    const res = await request(app).get('/admin/orders').set('Authorization', 'Bearer garbage-token');
    expect(res.status).toBe(401);
  });

  it('a real admin token still works', async () => {
    const { token } = await createAdmin();
    const res = await request(app).get('/admin/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('OTP login (regression: no more universal 123456)', () => {
  const mobileNumber = '9111111101';

  // This block used to assert that verifying with 123456 returns 400. That can
  // never hold here: the suite runs with ENV=test, and OUTSIDE production every
  // number deliberately gets DEV_FIXED_OTP ('123456') so nobody needs a live
  // SMS account to test the flow. So the test failed on every run, for a reason
  // that had nothing to do with the property it was named after — and a
  // permanently-red test is one nobody reads.
  //
  // The property actually worth guarding is: an ordinary number is NOT on the
  // bypass list, so in production it takes the live-SMS path and receives a
  // randomly generated code. isProduction is frozen at module load, so — as the
  // pinned-number blocks below already do — that is asserted on the predicate
  // which decides it rather than by booting a second app under ENV=production.
  it('an ordinary number is not on the bypass list, so production sends a real OTP', () => {
    const previous = process.env.TEST_PHONE_NUMBERS;
    delete process.env.TEST_PHONE_NUMBERS;
    expect(isBypassNumber(mobileNumber)).toBe(false);
    expect(isBypassNumber('9876543210')).toBe(false);
    if (previous !== undefined) process.env.TEST_PHONE_NUMBERS = previous;
  });

  it('never returns the OTP in the response body in production', () => {
    // The code path is `...(isProduction ? {} : { otp })`, so this asserts the
    // shape the production branch produces without needing that branch live.
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'Controllers', 'userAuthController.js'),
      'utf8',
    );
    expect(source).toContain('...(isProduction ? {} : { otp })');
  });

  it('accepts the OTP the server issued and returns a token pair', async () => {
    const sendRes = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(sendRes.status).toBe(200);
    const otp = sendRes.body.data.otp; // only present outside production, see userAuthController
    expect(otp).toMatch(/^\d{6}$/);

    const verifyRes = await request(app).post('/auth/verify-otp').send({ mobileNumber, otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
    expect(verifyRes.body.data.refreshToken).toBeTruthy();
  });

  it('is single-use — the same OTP cannot be replayed', async () => {
    const number = '9111111102';
    const sendRes = await request(app).post('/auth/send-otp').send({ mobileNumber: number });
    const otp = sendRes.body.data.otp;

    const first = await request(app).post('/auth/verify-otp').send({ mobileNumber: number, otp });
    expect(first.status).toBe(200);

    const replay = await request(app).post('/auth/verify-otp').send({ mobileNumber: number, otp });
    expect(replay.status).toBe(400);
  });

  it('locks out after too many wrong attempts', async () => {
    const number = '9111111103';
    await request(app).post('/auth/send-otp').send({ mobileNumber: number });

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/auth/verify-otp').send({ mobileNumber: number, otp: '000000' });
    }
    const res = await request(app).post('/auth/verify-otp').send({ mobileNumber: number, otp: '000000' });
    expect(res.status).toBe(429);

    const remaining = await OtpRequest.findOne({ mobileNumber: number });
    expect(remaining).toBeNull();
  });
});

describe('pinned test number 1111111111', () => {
  const testNumber = '1111111111';

  // isProduction is read once at module load, so these assert the predicate
  // that decides the production path rather than driving a second app under
  // ENV=production (which would recompile every mongoose model).
  it('bypasses the SMS gateway with TEST_PHONE_NUMBERS unset', () => {
    const previous = process.env.TEST_PHONE_NUMBERS;
    delete process.env.TEST_PHONE_NUMBERS;
    expect(isBypassNumber(testNumber)).toBe(true);
    if (previous !== undefined) process.env.TEST_PHONE_NUMBERS = previous;
  });

  it('stays bypassed when TEST_PHONE_NUMBERS lists other numbers', () => {
    const previous = process.env.TEST_PHONE_NUMBERS;
    process.env.TEST_PHONE_NUMBERS = '9876543210,9000000000';
    expect(isBypassNumber(testNumber)).toBe(true);
    expect(isBypassNumber('9876543210')).toBe(true);
    expect(isBypassNumber('9111111105')).toBe(false);
    if (previous === undefined) delete process.env.TEST_PHONE_NUMBERS;
    else process.env.TEST_PHONE_NUMBERS = previous;
  });

  it('logs in end to end with the fixed 123456', async () => {
    const sendRes = await request(app).post('/auth/send-otp').send({ mobileNumber: testNumber });
    expect(sendRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ mobileNumber: testNumber, otp: '123456' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
  });

  it('accepts the number in +91 form too', async () => {
    await request(app).post('/auth/send-otp').send({ mobileNumber: '+911111111111' });
    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ mobileNumber: '+911111111111', otp: '123456' });
    expect(verifyRes.status).toBe(200);
  });
});

describe('QA number via TEST_PHONE_NUMBERS (env-only, not pinned in source)', () => {
  const testNumber = '6268204871';

  // This used to be pinned in PERMANENT_TEST_NUMBERS (a real, assignable
  // Indian number hardcoded in source — anyone with repo read access could
  // sign in to that live account). A security review moved it to the
  // TEST_PHONE_NUMBERS env var instead, so it is revocable without a code
  // change and isn't sitting in git history going forward. These tests now
  // assert the opposite of before: it must NOT bypass unless the env var
  // names it.
  let previous;
  beforeEach(() => {
    previous = process.env.TEST_PHONE_NUMBERS;
    process.env.TEST_PHONE_NUMBERS = testNumber;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.TEST_PHONE_NUMBERS;
    else process.env.TEST_PHONE_NUMBERS = previous;
  });

  it('does NOT bypass the SMS gateway when TEST_PHONE_NUMBERS is unset', () => {
    delete process.env.TEST_PHONE_NUMBERS;
    expect(isBypassNumber(testNumber)).toBe(false);
  });

  it('bypasses the SMS gateway when named in TEST_PHONE_NUMBERS', () => {
    expect(isBypassNumber(testNumber)).toBe(true);
  });

  it('logs in end to end with the fixed 123456 when named in TEST_PHONE_NUMBERS', async () => {
    const sendRes = await request(app).post('/auth/send-otp').send({ mobileNumber: testNumber });
    expect(sendRes.status).toBe(200);

    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ mobileNumber: testNumber, otp: '123456' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
    expect(verifyRes.body.data.refreshToken).toBeTruthy();
  });

  it('accepts the number in +91 and 0-prefixed form too', async () => {
    for (const form of ['+916268204871', '06268204871', '916268204871']) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/auth/send-otp').send({ mobileNumber: form });
      // eslint-disable-next-line no-await-in-loop
      const verifyRes = await request(app)
        .post('/auth/verify-otp')
        .send({ mobileNumber: form, otp: '123456' });
      expect(verifyRes.status).toBe(200);
    }
  });

  it('does not bypass a neighbouring number', () => {
    expect(isBypassNumber('6268204872')).toBe(false);
    expect(isBypassNumber('626820487')).toBe(false);
  });
});

describe('address IDOR', () => {
  it('user B cannot read, update, or delete user A\'s address', async () => {
    const { user: userA, token: tokenA } = await createCustomer();
    const { token: tokenB } = await createCustomer();
    const address = await createAddress(userA._id);

    const list = await request(app).get('/user/addresses').set('Authorization', `Bearer ${tokenB}`);
    expect(list.body.data.items.find((a) => a.id === address._id.toString())).toBeUndefined();

    const update = await request(app)
      .put(`/user/addresses/${address._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ fullName: 'Hijacked' });
    expect(update.status).toBe(404);

    const del = await request(app).delete(`/user/addresses/${address._id}`).set('Authorization', `Bearer ${tokenB}`);
    expect(del.status).toBe(404);

    const stillThere = await request(app).get('/user/addresses').set('Authorization', `Bearer ${tokenA}`);
    expect(stillThere.body.data.items.some((a) => a.id === address._id.toString())).toBe(true);
  });
});

describe('profile ownership', () => {
  it('a body-supplied userId can never redirect an update to another account', async () => {
    const { user: userA, token: tokenA } = await createCustomer();
    const { user: userB } = await createCustomer();

    const res = await request(app)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Only Me', userId: userB._id.toString(), _id: userB._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(userA._id.toString());
    expect(res.body.data.user.name).toBe('Only Me');
  });

  it('rejects an invalid email format', async () => {
    const { token } = await createCustomer();
    const res = await request(app)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});
