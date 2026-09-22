const cjProductService = require('../services/cj/cjProductService');
const cjAuthService = require('../services/cj/cjAuthService');
const cjProductCache = require('../services/cj/cjProductCache');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const {
  normalizeSearchItem,
  normalizeProductDetail,
  normalizeVariant,
} = require('../services/cj/cjProductAdapter');

// Thin HTTP layer over cjProductService — no business logic here beyond
// input parsing, caching and the normalized-DTO response envelope. Frontend
// never calls CJ directly (master plan §5) and never sees CJ's raw response
// shape (product-display hardening §1): everything here is passed through
// cjProductAdapter first.
//
// Caching lives at THIS layer, not inside cjProductService, on purpose:
// cjOnboardingService and cjInventoryService call cjProductService directly
// and must always see a live CJ read (stock/price sync must never serve a
// browsing-cache-stale number) — see cjProductCache.js's own comment on why
// this is an in-process TTL cache rather than Redis.

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 24;

function handleCjError(res, err) {
  const status = err.code === 'CJ_CREDENTIALS_MISSING' ? 400 : err.status && err.status < 500 ? 400 : 502;
  res.status(status).json({
    success: false,
    message:
      err.code === 'CJ_CREDENTIALS_MISSING'
        ? 'Connect a CJ account in Settings before browsing the catalogue.'
        : cjAuthService.safeFailureMessage(err.code) || 'Unable to reach CJ Dropshipping.',
  });
}

// GET /admin/cj/catalogue/categories
async function getCategories(req, res) {
  try {
    const categories = await cjProductCache.cached('categories', {}, cjProductCache.TTL.CATEGORY, () =>
      cjProductService.getCategories()
    );
    res.json({ success: true, message: 'CJ categories fetched successfully', data: categories });
  } catch (err) {
    handleCjError(res, err);
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// GET /admin/cj/catalogue?keyword=&categoryId=&minPrice=&maxPrice=&countryCode=&page=&limit=
async function searchProducts(req, res) {
  const q = req.query || {};

  const params = {
    keyword: q.keyword || undefined,
    categoryId: q.categoryId || undefined,
    productSku: q.sku || undefined,
    productId: q.productId || undefined,
    minPrice: toNumber(q.minPrice),
    maxPrice: toNumber(q.maxPrice),
    countryCode: q.countryCode || undefined,
    pageNum: toNumber(q.page ?? q.pageNum) || 1,
    pageSize: Math.min(toNumber(q.limit ?? q.pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };

  try {
    const result = await cjProductCache.cached('search', params, cjProductCache.TTL.SEARCH, () =>
      cjProductService.searchProducts(params)
    );

    const items = (result.list || []).map(normalizeSearchItem).filter(Boolean);

    // Duplicate-guard for the browse grid (not just the onboard endpoint):
    // an admin should never see an "onboard" checkbox on something already
    // in the store. ProductFulfillmentMapping.cjProductId is the same
    // linkage field cjOnboardingService checks before creating a new
    // Product — reused here rather than inventing a second signal.
    if (items.length > 0) {
      const mappedIds = await ProductFulfillmentMapping.find({
        provider: 'CJ',
        cjProductId: { $in: items.map((i) => i.externalProductId) },
      }).distinct('cjProductId');
      const onboardedSet = new Set(mappedIds.map(String));
      items.forEach((item) => {
        item.isOnboarded = onboardedSet.has(item.externalProductId);
      });
    }

    res.json({
      success: true,
      message: 'CJ products fetched successfully',
      data: {
        items,
        pagination: {
          page: result.pageNum,
          limit: result.pageSize,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
        },
      },
    });
  } catch (err) {
    handleCjError(res, err);
  }
}

// GET /admin/cj/catalogue/:productId — normalized detail + variants.
// Deliberately does NOT fetch live stock (that's its own slower per-variant
// call, cjProductService.getVariantTotalStock) — a detail-view open should
// not block on N warehouse lookups before it can render.
async function getProductDetail(req, res) {
  const { productId } = req.params;

  try {
    const [rawDetail, rawVariants] = await Promise.all([
      cjProductCache.cached('detail', { productId }, cjProductCache.TTL.DETAIL, () =>
        cjProductService.getProductDetail(productId)
      ),
      cjProductCache.cached('variants', { productId }, cjProductCache.TTL.VARIANTS, () =>
        cjProductService.getProductVariants(productId)
      ),
    ]);

    const detail = normalizeProductDetail(rawDetail);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'CJ product not found' });
    }

    res.json({
      success: true,
      message: 'CJ product detail fetched successfully',
      data: {
        ...detail,
        variants: (rawVariants || []).map(normalizeVariant).filter(Boolean),
      },
    });
  } catch (err) {
    handleCjError(res, err);
  }
}

// GET /admin/cj/catalogue/variants/:variantId/stock — deliberately
// UNCACHED. Stock is exactly the kind of dynamic data master plan §13 says
// must never share a TTL with static content.
async function getVariantStock(req, res) {
  try {
    const stock = await cjProductService.getVariantStock(req.params.variantId);
    res.json({ success: true, message: 'CJ variant stock fetched successfully', data: stock });
  } catch (err) {
    handleCjError(res, err);
  }
}

module.exports = { getCategories, searchProducts, getProductDetail, getVariantStock };
