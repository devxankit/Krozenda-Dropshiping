const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const migrateFcmTokens = require('../utils/migrateFcmTokens');
const { connectTestDb, disconnectTestDb, createCustomer, createAdmin, createVendor } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

describe('fcm token registration', () => {
  it('stores token with deviceType', async () => {
    const { user, token } = await createCustomer();

    const res = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-app-1', deviceType: 'app' });

    expect(res.status).toBe(200);
    const fresh = await User.findById(user._id);
    expect(fresh.fcmTokens.map((t) => ({ token: t.token, deviceType: t.deviceType }))).toEqual([
      { token: 'tok-app-1', deviceType: 'app' },
    ]);
  });

  it('is idempotent and updates deviceType in place', async () => {
    const { user, token } = await createCustomer();
    const post = (body) =>
      request(app)
        .post('/fcm-token')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    await post({ token: 'tok-dup', deviceType: 'web' });
    await post({ token: 'tok-dup', deviceType: 'web' });
    await post({ token: 'tok-dup', deviceType: 'app' });

    const fresh = await User.findById(user._id);
    expect(fresh.fcmTokens).toHaveLength(1);
    expect(fresh.fcmTokens[0].deviceType).toBe('app');
  });

  it('rejects a missing or unknown deviceType', async () => {
    const { token } = await createCustomer();

    const missing = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-x' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/deviceType is required/);

    const bad = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-x', deviceType: 'android' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/web, app/);

    const noToken = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ deviceType: 'web' });
    expect(noToken.status).toBe(400);
    expect(noToken.body.message).toMatch(/token is required/);
  });

  it('moves a shared device token off the previous account', async () => {
    const first = await createCustomer();
    const second = await createCustomer();

    await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${first.token}`)
      .send({ token: 'shared-device', deviceType: 'app' });
    await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${second.token}`)
      .send({ token: 'shared-device', deviceType: 'app' });

    expect((await User.findById(first.user._id)).fcmTokens).toHaveLength(0);
    expect((await User.findById(second.user._id)).fcmTokens).toHaveLength(1);
  });

  it('files a vendor token against the vendor, not the buyer collection', async () => {
    const { vendor, token } = await createVendor();

    const res = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-vendor-1', deviceType: 'app' });

    expect(res.status).toBe(200);
    const fresh = await Vendor.findById(vendor._id);
    expect(fresh.fcmTokens.map((t) => t.token)).toEqual(['tok-vendor-1']);
  });

  it('accepts an admin token too', async () => {
    const { admin, token } = await createAdmin();

    const res = await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-admin-1', deviceType: 'web' });

    expect(res.status).toBe(200);
    expect((await User.findById(admin._id)).fcmTokens.map((t) => t.token)).toEqual(['tok-admin-1']);
  });

  it('moves a shared device across collections when the audience changes', async () => {
    const buyer = await createCustomer();
    const seller = await createVendor();
    const post = (bearer) =>
      request(app)
        .post('/fcm-token')
        .set('Authorization', `Bearer ${bearer}`)
        .send({ token: 'shared-across', deviceType: 'app' });

    await post(buyer.token);
    await post(seller.token);

    expect((await User.findById(buyer.user._id)).fcmTokens).toHaveLength(0);
    expect((await Vendor.findById(seller.vendor._id)).fcmTokens).toHaveLength(1);
  });

  it('rejects a request with no bearer token', async () => {
    const res = await request(app).post('/fcm-token').send({ token: 'tok-anon', deviceType: 'web' });
    expect(res.status).toBe(401);
  });

  it('removes a token by token alone', async () => {
    const { user, token } = await createCustomer();
    await request(app)
      .post('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-bye', deviceType: 'web' });

    const res = await request(app)
      .delete('/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok-bye' });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).fcmTokens).toHaveLength(0);
  });
});

describe('legacy fcmTokens migration', () => {
  it('converts raw string tokens to { token, deviceType: web }', async () => {
    const { user } = await createCustomer();

    // Write the pre-migration shape straight through the driver, the way an
    // existing production document looks.
    await mongoose.connection
      .collection('users')
      .updateOne({ _id: user._id }, { $set: { fcmTokens: ['legacy-a', 'legacy-b'] } });

    await migrateFcmTokens();

    const fresh = await User.findById(user._id);
    expect(fresh.fcmTokens.map((t) => [t.token, t.deviceType])).toEqual([
      ['legacy-a', 'web'],
      ['legacy-b', 'web'],
    ]);

    // Second run is a no-op, not a double-wrap.
    await migrateFcmTokens();
    const again = await User.findById(user._id);
    expect(again.fcmTokens.map((t) => [t.token, t.deviceType])).toEqual([
      ['legacy-a', 'web'],
      ['legacy-b', 'web'],
    ]);
  });
});
