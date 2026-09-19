const crypto = require('crypto');
const Product = require('../../Models/Product');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const CjSyncLog = require('../../Models/CjSyncLog');
const cjProductService = require('./cjProductService');
const cjOnboardingService = require('./cjOnboardingService');
const { parseCjPrice } = require('./cjPricing');

// Phase 4 — stock + price sync for already-onboarded CJ products.
//
// Deliberately per-mapping and idempotent: re-running this for the same
// product just overwrites Product's stock/price with CJ's latest numbers, so
// a webhook firing twice or a poll cycle re-covering a product mid-sync
// (see cjSyncJob's lock, which prevents that anyway) is harmless.

async function logResult({ entity, entityId, product, operation, trigger, status, error, retryCount = 0 }) {
  await CjSyncLog.create({
    entity,
    entityId: String(entityId),
    product: product || null,
    operation,
    trigger,
    requestId: crypto.randomUUID(),
    status,
    error: error ? String(error).slice(0, 500) : '',
    retryCount,
  });
}

// Re-fetches CJ's current stock+price for every variant on one mapping and
// writes it onto both the mapping and the Product/variant documents.
//
// AUTOMATIC pricing mode recomputes the selling price from the fresh
// cost+shipping; MANUAL mode leaves the admin's price untouched and only
// updates stock — CJ's price never silently overwrites an admin-set price.
async function syncMapping(mapping, { trigger = 'SCHEDULED' } = {}) {
  const product = await Product.findById(mapping.product);
  if (!product) {
    await logResult({
      entity: 'PRODUCT',
      entityId: mapping.cjProductId,
      operation: 'STOCK_SYNC',
      trigger,
      status: 'FAILED',
      error: 'Krozenda product no longer exists',
    });
    return { ok: false };
  }

  mapping.syncStatus = 'SYNCING';
  await mapping.save();

  try {
    const [detail, cjVariants] = await Promise.all([
      cjProductService.getProductDetail(mapping.cjProductId),
      cjProductService.getProductVariants(mapping.cjProductId),
    ]);

    if (!detail) throw new Error('CJ product no longer available');

    const byVariantId = new Map((cjVariants || []).map((v) => [v.vid || v.variantId, v]));

    for (const mv of mapping.variants) {
      const live = byVariantId.get(mv.cjVariantId);
      if (!live) continue; // variant discontinued on CJ's side — leave last-known values, don't zero silently

      const liveCost = parseCjPrice(live.variantSellPrice ?? live.sellPrice);
      const liveShipping = parseCjPrice(live.logisticPrice);
      mv.providerCost = liveCost || mv.providerCost;
      mv.providerShippingCost = liveShipping || mv.providerShippingCost;
      // Stock is never on the variant-list response itself (verified against
      // a live account — its inventory fields come back null); it lives only
      // on the separate per-warehouse stock endpoint. See
      // cjProductService.getVariantTotalStock.
      mv.providerStock = await cjProductService.getVariantTotalStock(mv.cjVariantId);

      const productVariant = mv.krozendaVariantId
        ? product.variants.id(mv.krozendaVariantId)
        : null;

      if (productVariant) {
        productVariant.stock = mv.providerStock;
        if (mapping.pricingMode === 'AUTOMATIC') {
          productVariant.price = cjOnboardingService.computeSellingPrice({
            pricingMode: 'AUTOMATIC',
            marginRule: mapping.marginRule,
            providerCost: mv.providerCost,
            providerShippingCost: mv.providerShippingCost,
          });
        }
      }
    }

    if (product.variants.length > 0) {
      product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      if (mapping.pricingMode === 'AUTOMATIC') {
        product.price = Math.min(...product.variants.map((v) => v.price));
      }
    } else {
      const cost = parseCjPrice(detail.sellPrice);
      const shipping = parseCjPrice(detail.logisticPrice);
      product.stock = Number(detail.productStock ?? 0) || 0;
      if (mapping.pricingMode === 'AUTOMATIC') {
        product.price = cjOnboardingService.computeSellingPrice({
          pricingMode: 'AUTOMATIC',
          marginRule: mapping.marginRule,
          providerCost: cost,
          providerShippingCost: shipping,
        });
      }
    }

    await product.save();

    mapping.syncStatus = 'IDLE';
    mapping.lastSyncedAt = new Date();
    mapping.lastSyncError = '';
    await mapping.save();

    await logResult({
      entity: 'PRODUCT',
      entityId: mapping.cjProductId,
      product: product._id,
      operation: 'STOCK_SYNC',
      trigger,
      status: 'SUCCESS',
    });

    return { ok: true };
  } catch (err) {
    mapping.syncStatus = 'FAILED';
    mapping.lastSyncError = err.message || 'Sync failed';
    await mapping.save();

    await logResult({
      entity: 'PRODUCT',
      entityId: mapping.cjProductId,
      product: product._id,
      operation: 'STOCK_SYNC',
      trigger,
      status: 'FAILED',
      error: err.message,
    });

    return { ok: false, error: err.message };
  }
}

// Runs sync across every onboarded CJ mapping, sequentially — deliberately
// not parallel: cjRequestManager already throttles the underlying CJ calls,
// but running mappings one at a time keeps a single slow/failing product
// from starving the shared concurrency slots for everything after it.
async function syncAll({ trigger = 'SCHEDULED' } = {}) {
  const mappings = await ProductFulfillmentMapping.find({ provider: 'CJ' });
  const results = { total: mappings.length, succeeded: 0, failed: 0 };

  for (const mapping of mappings) {
    const result = await syncMapping(mapping, { trigger });
    if (result.ok) results.succeeded += 1;
    else results.failed += 1;
  }

  return results;
}

async function syncOneByCjProductId(cjProductId, { trigger = 'MANUAL' } = {}) {
  const mapping = await ProductFulfillmentMapping.findOne({ provider: 'CJ', cjProductId });
  if (!mapping) throw new Error('No onboarded mapping for this CJ product');
  return syncMapping(mapping, { trigger });
}

module.exports = { syncMapping, syncAll, syncOneByCjProductId };
