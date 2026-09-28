// CJ webhook: signature (Base64 HMAC-SHA256 keyed on the account's openId,
// in the `sign` header), messageId dedupe, and registration via
// POST /v1/webhook/set. cjClient.call is mocked — nothing reaches CJ.

jest.mock('../services/cj/cjClient', () => ({
  call: jest.fn(),
  CjError: class CjError extends Error {
    constructor(message, opts = {}) {
      super(message);
      Object.assign(this, opts);
    }
  },
}));
jest.mock('../services/cj/cjOrderService', () => ({
  refreshOrderStatus: jest.fn().mockResolvedValue({ status: 'SHIPPED' }),
}));
jest.mock('../services/cj/cjInventoryService', () => ({
  syncMapping: jest.fn().mockResolvedValue({ ok: true }),
  syncOneByCjProductId: jest.fn(),
  syncAll: jest.fn(),
}));

const crypto = require('crypto');
const mongoose = require('mongoose');
const { call } = require('../services/cj/cjClient');
const cjInventoryService = require('../services/cj/cjInventoryService');
const cjOrderService = require('../services/cj/cjOrderService');
const CjSettings = require('../Models/CjSettings');
const CjWebhookEvent = require('../Models/CjWebhookEvent');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const cjAuthService = require('../services/cj/cjAuthService');
const cjWebhookService = require('../services/cj/cjWebhookService');
const { handleCjWebhook, verifySignature, resetSecretCache } = require('../Controllers/cjWebhookController');
const { encrypt, decrypt } = require('../utils/secretBox');
const { connectTestDb, disconnectTestDb } = require('./helpers');

const OPEN_ID = '1234567890123456789';

function sign(raw, secret = OPEN_ID) {
  return crypto.createHmac('sha256', secret).update(raw).digest('base64');
}

function fakeReq(body, signature) {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    rawBody: raw,
    body,
    get: (name) => (name.toLowerCase() === 'sign' ? signature ?? sign(raw) : undefined),
  };
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

async function seedSettings({ withOpenId = true } = {}) {
  const settings = await CjSettings.getSettings();
  settings.encryptedEmail = encrypt('cj@example.com');
  settings.encryptedApiKey = encrypt('test-api-key');
  if (withOpenId) settings.webhookSecret = encrypt(OPEN_ID);
  await settings.save();
}

async function seedMapping(overrides = {}) {
  return ProductFulfillmentMapping.create({
    product: new mongoose.Types.ObjectId(),
    cjProductId: 'PID-1',
    variants: [{ cjVariantId: 'VID-1' }],
    ...overrides,
  });
}

beforeAll(async () => {
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  await connectTestDb();
});
afterAll(disconnectTestDb);

beforeEach(async () => {
  jest.clearAllMocks();
  cjAuthService.invalidate();
  resetSecretCache();
  await Promise.all([
    CjSettings.deleteMany({}),
    CjWebhookEvent.deleteMany({}),
    ProductFulfillmentMapping.deleteMany({}),
  ]);
});

describe('verifySignature', () => {
  it('accepts CJ’s Base64 HMAC and rejects hex, tampered bodies and wrong keys', () => {
    const raw = Buffer.from('{"messageId":"m1"}');
    expect(verifySignature(raw, sign(raw), OPEN_ID)).toBe(true);
    expect(verifySignature(raw, crypto.createHmac('sha256', OPEN_ID).update(raw).digest('hex'), OPEN_ID)).toBe(false);
    expect(verifySignature(Buffer.from('{"messageId":"m2"}'), sign(raw), OPEN_ID)).toBe(false);
    expect(verifySignature(raw, sign(raw, 'other'), OPEN_ID)).toBe(false);
    expect(verifySignature(raw, '', OPEN_ID)).toBe(false);
  });
});

describe('handleCjWebhook', () => {
  it('fails closed with 503 when no openId is on file', async () => {
    await seedSettings({ withOpenId: false });
    const res = fakeRes();
    await handleCjWebhook(fakeReq({ messageId: 'm1', type: 'PRODUCT', params: { pid: 'PID-1' } }), res);
    expect(res.statusCode).toBe(503);
  });

  it('rejects a bad signature with 401', async () => {
    await seedSettings();
    const res = fakeRes();
    await handleCjWebhook(fakeReq({ messageId: 'm1', type: 'PRODUCT', params: { pid: 'PID-1' } }, 'bm9wZQ=='), res);
    expect(res.statusCode).toBe(401);
    expect(cjInventoryService.syncMapping).not.toHaveBeenCalled();
  });

  it('syncs an onboarded product from params.pid and ignores a retried messageId', async () => {
    await seedSettings();
    await seedMapping();
    const body = { messageId: 'm1', type: 'PRODUCT', messageType: 'UPDATE', params: { pid: 'PID-1' } };

    const res = fakeRes();
    await handleCjWebhook(fakeReq(body), res);
    expect(res.statusCode).toBe(200);
    expect(cjInventoryService.syncMapping).toHaveBeenCalledTimes(1);
    expect(cjInventoryService.syncMapping.mock.calls[0][1]).toEqual({ trigger: 'WEBHOOK' });

    await handleCjWebhook(fakeReq(body), fakeRes());
    expect(cjInventoryService.syncMapping).toHaveBeenCalledTimes(1);
  });

  it('finds products from a STOCK push, whose params are keyed by variant id', async () => {
    await seedSettings();
    await seedMapping();
    const params = {
      'VID-1': [{ vid: 'VID-1', areaId: '2', areaEn: 'US Warehouse', countryCode: 'US', storageNum: 12 }],
      'VID-OTHER': [{ vid: 'VID-OTHER', areaId: '2', storageNum: 1 }],
    };
    await handleCjWebhook(fakeReq({ messageId: 'm2', type: 'STOCK', messageType: 'UPDATE', params }), fakeRes());
    expect(cjInventoryService.syncMapping).toHaveBeenCalledTimes(1);
  });

  it('finds the product from a VARIANT push’s params.vid', async () => {
    await seedSettings();
    await seedMapping();
    await handleCjWebhook(fakeReq({ messageId: 'm5', type: 'VARIANT', params: { vid: 'VID-1', fields: ['variantLength'] } }), fakeRes());
    expect(cjInventoryService.syncMapping).toHaveBeenCalledTimes(1);
  });

  it('refreshes the CJ order named by an ORDER push’s cjOrderId', async () => {
    await seedSettings();
    await handleCjWebhook(fakeReq({
      messageId: 'm6',
      type: 'ORDER',
      messageType: 'UPDATE',
      params: { orderNumber: 'api_x', cjOrderId: '210823100016290555', orderStatus: 'SHIPPED' },
    }), fakeRes());
    expect(cjOrderService.refreshOrderStatus).toHaveBeenCalledWith('210823100016290555');
  });

  it('skips products synced moments ago and products never onboarded', async () => {
    await seedSettings();
    await seedMapping({ lastSyncedAt: new Date() });
    await handleCjWebhook(fakeReq({ messageId: 'm3', type: 'STOCK', params: { pid: 'PID-1' } }), fakeRes());
    await handleCjWebhook(fakeReq({ messageId: 'm4', type: 'PRODUCT', params: { pid: 'UNKNOWN' } }), fakeRes());
    expect(cjInventoryService.syncMapping).not.toHaveBeenCalled();
  });
});

describe('openId capture and webhook registration', () => {
  it('stores the openId from login as the webhook secret', async () => {
    await seedSettings({ withOpenId: false });
    call.mockResolvedValueOnce({
      body: { data: { accessToken: 'at', accessTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(), openId: 42 } },
    });
    await cjAuthService.getAccessToken();
    const settings = await CjSettings.getSettingsWithSecrets();
    expect(decrypt(settings.webhookSecret)).toBe('42');
  });

  it('rejects non-HTTPS and localhost callback URLs without calling CJ', async () => {
    await seedSettings();
    await expect(cjWebhookService.register({ callbackUrl: 'http://example.com/api/webhook/cj' })).rejects.toMatchObject({ code: 'CJ_WEBHOOK_BAD_URL' });
    await expect(cjWebhookService.register({ callbackUrl: 'https://localhost/api/webhook/cj' })).rejects.toMatchObject({ code: 'CJ_WEBHOOK_BAD_URL' });
    expect(call).not.toHaveBeenCalled();
  });

  it('logs in for an openId when missing, then enables all four topics', async () => {
    await seedSettings({ withOpenId: false });
    const url = 'https://shop.example.com/api/webhook/cj';
    call
      .mockResolvedValueOnce({
        body: { data: { accessToken: 'at', accessTokenExpiryDate: new Date(Date.now() + 86400000).toISOString(), openId: 'OID' } },
      })
      .mockResolvedValueOnce({ body: { code: 200, result: true, message: 'Success' } });

    const settings = await cjWebhookService.register({ callbackUrl: url });

    const setCall = call.mock.calls.find(([req]) => req.path === cjWebhookService.SET_PATH)[0];
    for (const topic of cjWebhookService.TOPICS) {
      expect(setCall.body[topic]).toEqual({ type: 'ENABLE', callbackUrls: [url] });
    }
    expect(settings.webhookCallbackUrl).toBe(url);
    expect(settings.webhookRegisteredAt).toBeInstanceOf(Date);
  });

  it('surfaces CJ’s own rejection message', async () => {
    await seedSettings();
    await CjSettings.updateOne({}, {
      encryptedAccessToken: encrypt('at'),
      accessTokenExpiresAt: new Date(Date.now() + 86400000),
    });
    call.mockResolvedValueOnce({ body: { code: 1600100, result: false, message: 'callback url unreachable' } });
    await expect(cjWebhookService.register({ callbackUrl: 'https://shop.example.com/api/webhook/cj' }))
      .rejects.toMatchObject({ code: 'CJ_WEBHOOK_REJECTED', message: 'callback url unreachable' });
  });
});

describe('GET /admin/cj/settings serializer', () => {
  it('reports hasCredentials from the unselected encryptedApiKey', async () => {
    const { getSettings } = require('../Controllers/adminCjController');
    const res = fakeRes();
    await getSettings({}, res);
    expect(res.body.data.hasCredentials).toBe(false);

    await seedSettings();
    const res2 = fakeRes();
    await getSettings({}, res2);
    expect(res2.body.data.hasCredentials).toBe(true);
  });
});
