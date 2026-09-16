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

  it('rejects the old hardcoded 123456 for a fresh request', async () => {
    await request(app).post('/auth/send-otp').send({ mobileNumber });
    const res = await request(app).post('/auth/verify-otp').send({ mobileNumber, otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts the real (random, per-request) OTP and issues a token', async () => {
    const sendRes = await request(app).post('/auth/send-otp').send({ mobileNumber });
    expect(sendRes.status).toBe(200);
    const otp = sendRes.body.data.otp; // only present outside production, see userAuthController
    expect(otp).toMatch(/^\d{6}$/);

    const verifyRes = await request(app).post('/auth/verify-otp').send({ mobileNumber, otp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.accessToken).toBeTruthy();
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
