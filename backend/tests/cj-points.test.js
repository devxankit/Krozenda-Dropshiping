// CJ API points budget: an "Insufficient API points" refusal is a quota, not
// a connection failure. It must be reported as such, stop further CJ calls
// for a while, and cut a sync cycle short instead of burning through every
// product with calls CJ will refuse.

jest.mock('../services/cj/cjProductService', () => ({
  getProductDetail: jest.fn(),
  getProductVariants: jest.fn(),
  getProductStockByVariant: jest.fn(),
}));

const cjProductService = require('../services/cj/cjProductService');
const { mapErrorCode, call } = require('../services/cj/cjClient');
const pointsGuard = require('../services/cj/cjPointsGuard');
const cjAuthService = require('../services/cj/cjAuthService');
const cjInventoryService = require('../services/cj/cjInventoryService');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const CjSyncLog = require('../Models/CjSyncLog');
const { connectTestDb, disconnectTestDb, createCategory, createProduct } = require('./helpers');

const POINTS_MESSAGE =
  'Insufficient API points. Used today: 69750, Remaining: 0, Required: 10. To increase your daily points, grow your CJ transaction amount.';

function quotaError(code = 'CJ_POINTS_EXHAUSTED') {
  return Object.assign(new Error(POINTS_MESSAGE), { code, status: 200 });
}

async function makeMapping(cjProductId, lastSyncedAt = null) {
  const category = await createCategory();
  const product = await createProduct({ category: category._id });
  return ProductFulfillmentMapping.create({
    product: product._id,
    cjProductId,
    variants: [],
    lastSyncedAt,
  });
}

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

beforeEach(async () => {
  pointsGuard.reset();
  jest.clearAllMocks();
  await ProductFulfillmentMapping.deleteMany({});
  await CjSyncLog.deleteMany({});
});

describe('CJ quota errors', () => {
  test('are recognised from the message CJ sends with HTTP 200', () => {
    expect(mapErrorCode(200, 1600200, POINTS_MESSAGE)).toBe('CJ_POINTS_EXHAUSTED');
    expect(mapErrorCode(200, 1600200, 'Too Many Requests, QPS limit is 1 time/1second')).toBe('CJ_RATE_LIMITED');
    expect(mapErrorCode(401, null, 'Unauthorized')).toBe('CJ_UNAUTHORIZED');
  });

  test('tell the admin it is a quota, not to reconnect', () => {
    const message = cjAuthService.safeFailureMessage('CJ_POINTS_EXHAUSTED');
    expect(message).toMatch(/daily API limit/);
    expect(message).toMatch(/No need to reconnect/);
  });

  test('once CJ reports no points, calls fail fast without reaching CJ', async () => {
    pointsGuard.markExhausted();
    await expect(call({ path: '/v1/product/query' })).rejects.toMatchObject({ code: 'CJ_POINTS_EXHAUSTED' });
    expect(pointsGuard.canSpendInBackground()).toBe(false);
  });

  test('background work keeps a reserve of points', () => {
    pointsGuard.record({ total: 50000, usedToday: 46000, remaining: 4000 });
    expect(pointsGuard.canSpendInBackground(5000)).toBe(false);
    expect(pointsGuard.canSpendInBackground(1000)).toBe(true);
  });
});

describe('stock sync under the points budget', () => {
  test('stops the cycle at the first quota refusal and does not mark products failed', async () => {
    const a = await makeMapping('A', new Date('2026-01-01'));
    const b = await makeMapping('B', new Date('2026-01-02'));
    await makeMapping('C', new Date('2026-01-03'));

    cjProductService.getProductDetail.mockImplementation(async (pid) => {
      if (pid === 'B') throw quotaError();
      return { productStock: 7, sellPrice: '1.00' };
    });
    cjProductService.getProductVariants.mockResolvedValue([]);
    cjProductService.getProductStockByVariant.mockResolvedValue(new Map());

    const result = await cjInventoryService.syncAll({ trigger: 'SCHEDULED' });

    expect(result).toMatchObject({ total: 3, succeeded: 1, failed: 0, skipped: 2, stoppedReason: 'CJ_POINTS_LOW' });
    // Stalest first, and C was never asked for.
    expect(cjProductService.getProductDetail.mock.calls.map(([pid]) => pid)).toEqual(['A', 'B']);
    expect((await ProductFulfillmentMapping.findById(b._id)).syncStatus).toBe('IDLE');
    expect((await ProductFulfillmentMapping.findById(a._id)).syncStatus).toBe('IDLE');
    expect(await CjSyncLog.countDocuments({ status: 'FAILED' })).toBe(0);
  });

  test('a scheduled run does not start while points are below the reserve', async () => {
    await makeMapping('A');
    pointsGuard.record({ total: 50000, usedToday: 49000, remaining: 1000 });

    const result = await cjInventoryService.syncAll({ trigger: 'SCHEDULED' });

    expect(result).toMatchObject({ succeeded: 0, skipped: 1, stoppedReason: 'CJ_POINTS_LOW' });
    expect(cjProductService.getProductDetail).not.toHaveBeenCalled();
  });

  test('variant stock comes from one per-product call', async () => {
    const category = await createCategory();
    const product = await createProduct({
      category: category._id,
      variants: [
        { name: 'Red', sku: 'R', price: 100, stock: 1 },
        { name: 'Blue', sku: 'B', price: 100, stock: 1 },
      ],
    });
    await ProductFulfillmentMapping.create({
      product: product._id,
      cjProductId: 'P1',
      variants: [
        { cjVariantId: 'v1', krozendaVariantId: product.variants[0]._id },
        { cjVariantId: 'v2', krozendaVariantId: product.variants[1]._id },
      ],
    });

    cjProductService.getProductDetail.mockResolvedValue({ sellPrice: '1.00' });
    cjProductService.getProductVariants.mockResolvedValue([
      { vid: 'v1', variantSellPrice: '1.00' },
      { vid: 'v2', variantSellPrice: '1.00' },
    ]);
    cjProductService.getProductStockByVariant.mockResolvedValue(
      new Map([
        ['v1', 40],
        ['v2', 2],
      ])
    );

    const result = await cjInventoryService.syncAll({ trigger: 'MANUAL' });

    expect(result.succeeded).toBe(1);
    expect(cjProductService.getProductStockByVariant).toHaveBeenCalledTimes(1);
    const Product = require('../Models/Product');
    const saved = await Product.findById(product._id);
    expect(saved.variants.map((v) => v.stock)).toEqual([40, 2]);
    expect(saved.stock).toBe(42);
  });
});
