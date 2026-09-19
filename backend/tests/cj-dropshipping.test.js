// Phase 9 — production tests for the CJ Dropshipping hardening requirements
// (project memory "cj-dropshipping-architecture"). These target the six
// mandatory safeguards directly rather than re-testing plain CRUD: a
// concurrent token refresh must collapse to one login, a retried order
// creation must never double-create, a slow sync cycle must never overlap
// itself.
//
// cjClient.call (the one function that actually reaches the network) is
// mocked throughout — these tests verify OUR concurrency/idempotency
// logic, not CJ's live API.

jest.mock('../services/cj/cjClient', () => ({
  call: jest.fn(),
  CjError: class CjError extends Error {
    constructor(message, opts = {}) {
      super(message);
      Object.assign(this, opts);
    }
  },
}));

const crypto = require('crypto');
const { call } = require('../services/cj/cjClient');
const CjSettings = require('../Models/CjSettings');
const CjOrder = require('../Models/CjOrder');
const CjSyncLog = require('../Models/CjSyncLog');
const cjAuthService = require('../services/cj/cjAuthService');
const cjOrderService = require('../services/cj/cjOrderService');
const cjOnboardingService = require('../services/cj/cjOnboardingService');
const { mapCjStatus } = require('../services/cj/cjStatusMapper');
const cjSyncJob = require('../Jobs/cjSyncJob');
const cjInventoryService = require('../services/cj/cjInventoryService');

const { connectTestDb, disconnectTestDb } = require('./helpers');

// Polls until `predicate()` is true or `timeoutMs` elapses. Needed instead of
// a single setImmediate/microtask flush wherever the code path under test
// makes real (mocked-at-the-network-boundary but still async) Mongoose
// round trips before reaching the assertion point — a single tick is not
// enough to let those actually settle.
async function waitFor(predicate, { timeoutMs = 2000, intervalMs = 10 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: timed out waiting for condition');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

const TEST_KEY = crypto.randomBytes(32).toString('hex');

beforeAll(async () => {
  process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
  await connectTestDb();
});
afterAll(disconnectTestDb);

beforeEach(async () => {
  jest.clearAllMocks();
  cjAuthService.invalidate();
  await Promise.all([
    CjSettings.deleteMany({}),
    CjOrder.deleteMany({}),
    CjSyncLog.deleteMany({}),
  ]);
});

async function seedCredentials() {
  const settings = await CjSettings.getSettings();
  const { encrypt } = require('../utils/secretBox');
  settings.encryptedEmail = encrypt('cj@example.com');
  settings.encryptedApiKey = encrypt('test-api-key');
  await settings.save();
}

// ---------------------------------------------------------------------------
// Hardening req #1 — token refresh single-flight lock
// ---------------------------------------------------------------------------
describe('cjAuthService — single-flight token refresh', () => {
  it('collapses N concurrent getAccessToken calls into exactly one login request', async () => {
    await seedCredentials();

    let resolveLogin;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    call.mockImplementation(() => loginPromise);

    // Fire 5 concurrent callers before the (slow) login resolves.
    const callers = Array.from({ length: 5 }, () => cjAuthService.getAccessToken());

    // Wait for the (mocked, but still real-async) chain inside getAccessToken
    // to actually reach the login call, then give it a beat to make sure a
    // SECOND one doesn't also sneak in.
    await waitFor(() => call.mock.calls.length > 0);
    await new Promise((r) => setTimeout(r, 50));

    expect(call).toHaveBeenCalledTimes(1);

    resolveLogin({
      status: 200,
      body: {
        data: {
          accessToken: 'token-1',
          accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
          refreshToken: 'refresh-1',
        },
      },
    });

    const tokens = await Promise.all(callers);
    expect(new Set(tokens)).toEqual(new Set(['token-1']));
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh cached token without calling CJ again', async () => {
    await seedCredentials();
    call.mockResolvedValue({
      status: 200,
      body: {
        data: {
          accessToken: 'token-1',
          accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
          refreshToken: 'refresh-1',
        },
      },
    });

    await cjAuthService.getAccessToken();
    await cjAuthService.getAccessToken();
    await cjAuthService.getAccessToken();

    expect(call).toHaveBeenCalledTimes(1);
  });

  it('withAuth re-authenticates exactly once on a token-expiry error, not in a loop', async () => {
    await seedCredentials();

    call
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: {
            accessToken: 'stale-token',
            accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
            refreshToken: 'refresh-1',
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: {
            accessToken: 'fresh-token',
            accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
            refreshToken: 'refresh-2',
          },
        },
      });

    let attempt = 0;
    const makeRequest = jest.fn(async (token) => {
      attempt += 1;
      if (attempt === 1) {
        const err = new Error('unauthorized');
        err.code = 'CJ_UNAUTHORIZED';
        throw err;
      }
      return { token };
    });

    const result = await cjAuthService.withAuth(makeRequest);
    expect(result).toEqual({ token: 'fresh-token' });
    expect(makeRequest).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Hardening req: idempotent CJ order creation
// ---------------------------------------------------------------------------
describe('cjOrderService — idempotent order creation', () => {
  const baseOrder = {
    krozendaOrderId: undefined, // filled per test with a fresh ObjectId
    krozendaSubOrderId: 'SUBORDER-1',
    items: [{ product: undefined, cjProductId: 'P1', cjVariantId: 'V1', quantity: 1, unitCost: 100 }],
    shippingAddress: { countryCode: 'IN', city: 'Mumbai', line: 'x', name: 'y', zip: '400001', phone: '9999999999' },
  };

  beforeEach(async () => {
    await seedCredentials();
    call.mockResolvedValue({
      status: 200,
      body: {
        data: {
          accessToken: 'token-1',
          accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
          refreshToken: 'refresh-1',
        },
      },
    });
  });

  it('never calls CJ create-order twice for the same krozendaSubOrderId', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();

    // First auth call, then the create-order call.
    call.mockImplementation((req) => {
      if (req.path === cjAuthService.LOGIN_PATH) {
        return Promise.resolve({
          status: 200,
          body: {
            data: {
              accessToken: 'token-1',
              accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
              refreshToken: 'refresh-1',
            },
          },
        });
      }
      return Promise.resolve({ status: 200, body: { data: { orderId: 'CJ-ORDER-1' } } });
    });

    const payload = {
      ...baseOrder,
      krozendaOrderId: orderId,
      items: [{ ...baseOrder.items[0], product: productId }],
    };

    const first = await cjOrderService.createOrder(payload);
    const createOrderCalls = call.mock.calls.filter(([req]) => req.path.includes('createOrder')).length;
    expect(createOrderCalls).toBe(1);
    expect(first.cjOrderId).toBe('CJ-ORDER-1');

    // Retry with the SAME sub-order id — must short-circuit, no new network call.
    const second = await cjOrderService.createOrder(payload);
    const createOrderCallsAfterRetry = call.mock.calls.filter(([req]) => req.path.includes('createOrder')).length;
    expect(createOrderCallsAfterRetry).toBe(1);
    expect(second.cjOrderId).toBe('CJ-ORDER-1');
    expect(String(second._id)).toBe(String(first._id));

    const rows = await CjOrder.find({ krozendaSubOrderId: 'SUBORDER-1' });
    expect(rows).toHaveLength(1);
  });

  it('marks a timed-out create as reconciliation-required, not a normal failure', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();

    call.mockImplementation((req) => {
      if (req.path === cjAuthService.LOGIN_PATH) {
        return Promise.resolve({
          status: 200,
          body: {
            data: {
              accessToken: 'token-1',
              accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
              refreshToken: 'refresh-1',
            },
          },
        });
      }
      const err = new Error('timed out');
      err.isTimeout = true;
      err.code = 'CJ_TIMEOUT';
      return Promise.reject(err);
    });

    await expect(
      cjOrderService.createOrder({
        ...baseOrder,
        krozendaSubOrderId: 'SUBORDER-TIMEOUT',
        krozendaOrderId: orderId,
        items: [{ ...baseOrder.items[0], product: productId }],
      })
    ).rejects.toMatchObject({ code: 'CJ_ORDER_RECONCILIATION_REQUIRED' });

    const saved = await CjOrder.findOne({ krozendaSubOrderId: 'SUBORDER-TIMEOUT' });
    expect(saved.cjOrderId).toBeNull();
    expect(saved.status).not.toBe('FULFILLMENT_FAILED'); // unknown outcome, not a known failure
  });

  it('marks a genuine CJ rejection as FULFILLMENT_FAILED', async () => {
    const mongoose = require('mongoose');
    const orderId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();

    call.mockImplementation((req) => {
      if (req.path === cjAuthService.LOGIN_PATH) {
        return Promise.resolve({
          status: 200,
          body: {
            data: {
              accessToken: 'token-1',
              accessTokenExpiryDate: new Date(Date.now() + 3600_000).toISOString(),
              refreshToken: 'refresh-1',
            },
          },
        });
      }
      const err = new Error('out of stock');
      err.code = 'CJ_HTTP_ERROR';
      return Promise.reject(err);
    });

    await expect(
      cjOrderService.createOrder({
        ...baseOrder,
        krozendaSubOrderId: 'SUBORDER-FAILED',
        krozendaOrderId: orderId,
        items: [{ ...baseOrder.items[0], product: productId }],
      })
    ).rejects.toMatchObject({ code: 'CJ_ORDER_CREATE_FAILED' });

    const saved = await CjOrder.findOne({ krozendaSubOrderId: 'SUBORDER-FAILED' });
    expect(saved.status).toBe('FULFILLMENT_FAILED');
  });
});

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
describe('cjStatusMapper', () => {
  it('maps known CJ statuses to internal statuses', () => {
    expect(mapCjStatus('WAIT_PAY')).toBe('PENDING_PAYMENT');
    expect(mapCjStatus('PAID')).toBe('CONFIRMED');
    expect(mapCjStatus('SHIPPED')).toBe('SHIPPED');
    expect(mapCjStatus('COMPLETED')).toBe('DELIVERED');
    expect(mapCjStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('never throws on an unrecognised CJ status and falls back safely', () => {
    expect(mapCjStatus('SOME_FUTURE_CJ_STATUS')).toBe('PROCESSING');
    expect(mapCjStatus(undefined)).toBe('PROCESSING');
  });
});

// ---------------------------------------------------------------------------
// Pricing engine
// ---------------------------------------------------------------------------
describe('cjOnboardingService — pricing engine', () => {
  it('manual mode requires a positive sellingPrice', () => {
    expect(() =>
      cjOnboardingService.computeSellingPrice({ pricingMode: 'MANUAL', manualPrice: 0 })
    ).toThrow();
    expect(
      cjOnboardingService.computeSellingPrice({ pricingMode: 'MANUAL', manualPrice: 999 })
    ).toBe(999);
  });

  it('automatic mode converts USD provider cost to INR before adding margin', () => {
    const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
    const price = cjOnboardingService.computeSellingPrice({
      pricingMode: 'AUTOMATIC',
      marginRule: { type: 'PERCENT', value: 20 },
      providerCost: 5, // USD
      providerShippingCost: 1.5, // USD
    });
    // base = (5 + 1.5) * USD_TO_INR_RATE, +20% margin on that base
    const base = 6.5 * USD_TO_INR_RATE;
    expect(price).toBeCloseTo(Math.round((base + base * 0.2) * 100) / 100, 5);
  });

  it('automatic mode computes cost + shipping + margin (flat, in INR after conversion)', () => {
    const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
    const price = cjOnboardingService.computeSellingPrice({
      pricingMode: 'AUTOMATIC',
      marginRule: { type: 'FLAT', value: 349 },
      providerCost: 5,
      providerShippingCost: 1.5,
    });
    const base = 6.5 * USD_TO_INR_RATE;
    expect(price).toBeCloseTo(Math.round((base + 349) * 100) / 100, 5);
  });
});

describe('cjPricing — parseCjPrice', () => {
  const { parseCjPrice } = require('../services/cj/cjPricing');

  it('parses a plain number unchanged', () => {
    expect(parseCjPrice(10.07)).toBe(10.07);
  });

  it('parses the low end of a range string instead of returning NaN', () => {
    expect(parseCjPrice('5.00-8.00')).toBe(5);
  });

  it('returns 0 for unparseable input, never NaN', () => {
    expect(parseCjPrice(null)).toBe(0);
    expect(parseCjPrice(undefined)).toBe(0);
    expect(parseCjPrice('n/a')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Hardening req #5 — sync job overlap lock
// ---------------------------------------------------------------------------
describe('cjSyncJob — overlap prevention', () => {
  it('skips a run that starts while a previous run is still in progress', async () => {
    let resolveFirst;
    const firstRunGate = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const spy = jest.spyOn(cjInventoryService, 'syncAll').mockImplementation(() => firstRunGate);

    const firstRun = cjSyncJob.runOnce();
    // Second run starts before the first has resolved — must be skipped, not queued.
    const secondRun = await cjSyncJob.runOnce();

    expect(secondRun).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);

    resolveFirst({ total: 0, succeeded: 0, failed: 0 });
    await firstRun;

    spy.mockRestore();
  });

  it('allows a new run once the previous one has finished', async () => {
    const spy = jest.spyOn(cjInventoryService, 'syncAll').mockResolvedValue({ total: 0, succeeded: 0, failed: 0 });

    await cjSyncJob.runOnce();
    await cjSyncJob.runOnce();

    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
