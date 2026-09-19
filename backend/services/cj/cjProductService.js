const { call } = require('./cjClient');
const cjAuthService = require('./cjAuthService');
const requestManager = require('./cjRequestManager');

// Live CJ catalogue access — Phase 2 of the master plan.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: CJ's catalogue is never bulk-imported
// into Krozenda. Every function here is a live, on-demand read against CJ,
// used by the admin catalogue screen to search/browse before onboarding a
// single product. Nothing in this file writes to Krozenda's own DB — that is
// cjOnboardingService's job (Phase 3).
//
// Every CJ call is routed through cjAuthService.withAuth (token handling,
// single-flight refresh) and requestManager.enqueue (shared rate limit) —
// no direct cjClient.call from here.

const CATEGORY_PATH = '/v1/product/getCategory';
const LIST_PATH = '/v1/product/list';
const DETAIL_PATH = '/v1/product/query';
const VARIANT_PATH = '/v1/product/variant/query';
const STOCK_PATH = '/v1/product/stock/queryByVid';

function authenticatedCall(request) {
  return cjAuthService.withAuth((accessToken) =>
    requestManager.enqueue(() => call({ ...request, accessToken }))
  );
}

// GET category tree: Fashion -> Men -> Footwear -> Sneakers, etc. Cheap and
// slow-changing, so callers (the admin UI's category filter) may cache this
// client-side for a session rather than re-fetching per keystroke.
async function getCategories({ onLog } = {}) {
  const { body } = await authenticatedCall({
    method: 'GET',
    path: CATEGORY_PATH,
    idempotent: true,
    onLog,
  });
  return body?.data || [];
}

// Live search/browse. Every filter is optional; CJ defaults pageNum=1,
// pageSize=20 when omitted. Mirrors the admin Catalogue screen's filter bar:
// keyword, category, price range, warehouse, pagination.
async function searchProducts(
  {
    keyword,
    categoryId,
    productSku,
    productId,
    minPrice,
    maxPrice,
    countryCode,
    pageNum = 1,
    pageSize = 20,
  } = {},
  { onLog } = {}
) {
  const query = {
    pageNum,
    pageSize,
    productNameEn: keyword,
    categoryId,
    productSku,
    pid: productId,
    minPrice,
    maxPrice,
    countryCode, // warehouse/availability filter — CJ ties stock to a country code
  };

  const { body } = await authenticatedCall({
    method: 'GET',
    path: LIST_PATH,
    query,
    idempotent: true,
    onLog,
  });

  const data = body?.data || {};
  return {
    list: data.list || [],
    pageNum: data.pageNum ?? pageNum,
    pageSize: data.pageSize ?? pageSize,
    total: data.total ?? 0,
  };
}

// Full detail for one product: images, description, variants summary,
// warehouse/shipping info. Called when admin opens a product from search
// results, before deciding to onboard it.
async function getProductDetail(productId, { onLog } = {}) {
  if (!productId) throw new Error('productId is required');

  const { body } = await authenticatedCall({
    method: 'GET',
    path: DETAIL_PATH,
    query: { pid: productId },
    idempotent: true,
    onLog,
  });
  return body?.data || null;
}

// Variant list for one product (SKU/color/size combinations + per-variant
// price). Kept separate from getProductDetail because CJ's own API separates
// them, and the admin UI fetches variants only once a product is opened.
async function getProductVariants(productId, { onLog } = {}) {
  if (!productId) throw new Error('productId is required');

  const { body } = await authenticatedCall({
    method: 'GET',
    path: VARIANT_PATH,
    query: { pid: productId },
    idempotent: true,
    onLog,
  });
  return body?.data || [];
}

// Live stock for one variant, by warehouse. Used both by the product detail
// screen (Phase 2) and by cjInventoryService's polling sync (Phase 4) — kept
// here since it's a read against the same /product surface, not a sync
// concern in itself.
async function getVariantStock(variantId, { onLog } = {}) {
  if (!variantId) throw new Error('variantId is required');

  const { body } = await authenticatedCall({
    method: 'GET',
    path: STOCK_PATH,
    query: { vid: variantId },
    idempotent: true,
    onLog,
  });
  return body?.data || [];
}

// Total sellable stock for one variant, summed across every warehouse CJ
// reports it in. Verified against a live account: variant list/detail
// responses do NOT carry stock at all (their inventory fields come back
// null) — it only exists on this separate per-warehouse endpoint, keyed by
// `totalInventoryNum` per warehouse row. Onboarding and inventory sync both
// need a single number, so this is the one place that summing happens.
async function getVariantTotalStock(variantId, { onLog } = {}) {
  const warehouses = await getVariantStock(variantId, { onLog });
  return (warehouses || []).reduce((sum, w) => sum + (Number(w.totalInventoryNum) || 0), 0);
}

module.exports = {
  getCategories,
  searchProducts,
  getProductDetail,
  getProductVariants,
  getVariantStock,
  getVariantTotalStock,
};
