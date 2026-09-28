// What reaches Firebase and which tokens get pruned. Firebase's messaging
// client is replaced with a recorder whose per-token result the test sets.
const sent = [];
let failWith = {}; // token -> FCM error code
jest.mock('../Config/firebase', () => ({
  isFirebaseConfigured: true,
  messaging: {
    sendEachForMulticast: jest.fn(async (message) => {
      sent.push(message);
      const responses = message.tokens.map((token) =>
        failWith[token] ? { success: false, error: { code: failWith[token] } } : { success: true }
      );
      return {
        successCount: responses.filter((r) => r.success).length,
        failureCount: responses.filter((r) => !r.success).length,
        responses,
      };
    }),
  },
}));

const request = require('supertest');
const app = require('../app');
const Customer = require('../Models/Customer');
const { createNotification } = require('../Controllers/notificationController');
const { connectTestDb, disconnectTestDb, createCustomer, createAdmin } = require('./helpers');

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(() => {
  sent.length = 0;
  failWith = {};
});

async function withTokens(tokens, overrides = {}) {
  const { user, token } = await createCustomer(overrides);
  await Customer.updateOne({ _id: user._id }, { $set: { fcmTokens: tokens.map((t) => ({ token: t, deviceType: 'web' })) } });
  return { user, token };
}
const tokensOf = async (id) => (await Customer.findById(id)).fcmTokens.map((t) => t.token);

describe('push delivery', () => {
  it('prunes a token FCM says is unregistered', async () => {
    const { user } = await withTokens(['live-1', 'dead-1']);
    failWith = { 'dead-1': 'messaging/registration-token-not-registered' };
    await createNotification({ userId: user._id, type: 'ORDER', title: 'Shipped', message: 'On its way' });
    expect(await tokensOf(user._id)).toEqual(['live-1']);
  });

  it('keeps tokens on invalid-argument — that is a payload error, not a dead token', async () => {
    const { user } = await withTokens(['a-1', 'a-2']);
    failWith = { 'a-1': 'messaging/invalid-argument', 'a-2': 'messaging/invalid-argument' };
    await createNotification({ userId: user._id, type: 'ORDER', title: 'Shipped', message: 'On its way' });
    expect(await tokensOf(user._id)).toEqual(['a-1', 'a-2']);
  });

  it('a deleted account loses its tokens and gets no more pushes', async () => {
    const { user, token } = await withTokens(['del-1']);
    const res = await request(app).delete('/auth/account').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await tokensOf(user._id)).toEqual([]);
    await createNotification({ userId: user._id, type: 'ORDER', title: 'Hi', message: 'x' });
    expect(sent).toHaveLength(0);
  });

  it('a campaign skips blocked buyers', async () => {
    const { token: adminToken } = await createAdmin();
    await withTokens(['camp-active']);
    await withTokens(['camp-blocked'], { isActive: false });
    const res = await request(app)
      .post('/admin/marketing/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Sale', message: 'Big sale', audience: 'customers' });
    expect(res.status).toBe(201);
    const pushed = sent.flatMap((m) => m.tokens);
    expect(pushed).toContain('camp-active');
    expect(pushed).not.toContain('camp-blocked');
  });
});
