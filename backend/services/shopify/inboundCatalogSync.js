const Product = require('../../Models/Product');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const catalogService = require('./shopifyCatalogService');
const { log } = require('./shopifyClient');

// Keeping the local copy of a Shopify product in step with the real one.
//
// WHO OWNS WHAT (decision F, and the whole reason this is a whitelist):
//   Shopify owns  stock, sku, the variant set, and the product's own status.
//   Krozenda owns title, description, images, and the SELLING PRICE.
//
// So an inbound change NEVER writes a Krozenda-owned field. That is not a
// nicety — it is what makes the two-way sync safe: the inbound path
// physically cannot undo an admin's pricing, which means it can never provoke
// an outbound write, which means there is no echo loop to break.
//
// Stock is the part that actually costs money. Without this, a product
// imported once keeps its stock figure forever and oversells the moment the
// supplier runs out.

/** `$set`, never `$inc`. The provider's figure is the truth, not a delta. */
function applyStock(product, mapping, quantities) {
  let changed = false;

  if ((product.variants || []).length > 0) {
    for (const variant of product.variants) {
      const link = (mapping.variants || []).find(
        (v) => v.krozendaVariantId && String(v.krozendaVariantId) === String(variant._id)
      );
      if (!link) continue;
      const next = quantities.get(link.externalVariantId) ?? quantities.get(link.externalInventoryItemId);
      if (next === undefined || next === null) continue;
      const safe = Math.max(0, Number(next) || 0);
      if (variant.stock !== safe) {
        variant.stock = safe;
        changed = true;
      }
    }
    // The product-level figure is the sum of its variants, or a buyer sees a
    // product "in stock" whose every option is sold out.
    const total = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    if (product.stock !== total) {
      product.stock = total;
      changed = true;
    }
  } else {
    const link = (mapping.variants || [])[0];
    const next = link && (quantities.get(link.externalVariantId) ?? quantities.get(link.externalInventoryItemId));
    if (next !== undefined && next !== null) {
      const safe = Math.max(0, Number(next) || 0);
      if (product.stock !== safe) {
        product.stock = safe;
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Re-read one mapped product from Shopify and apply the fields Shopify owns.
 */
async function syncMapping(mapping, { trigger = 'MANUAL' } = {}) {
  const product = await Product.findById(mapping.product);
  if (!product) return { ok: false, reason: 'PRODUCT_DELETED' };

  let shopifyProduct;
  try {
    shopifyProduct = await catalogService.getProduct(mapping.externalProductId);
  } catch (err) {
    await ProductFulfillmentMapping.updateOne(
      { _id: mapping._id },
      { $set: { syncStatus: 'FAILED', lastSyncError: String(err.message).slice(0, 400) } }
    );
    return { ok: false, reason: 'PROVIDER_ERROR', error: err.message };
  }

  // Deleted or archived upstream: hide it rather than keep selling something
  // the supplier no longer lists.
  if (!shopifyProduct) {
    const changed = product.isActive !== false;
    if (changed) {
      product.isActive = false;
      product.status = 'Draft';
      product.stock = 0;
      await product.save();
    }
    await ProductFulfillmentMapping.updateOne(
      { _id: mapping._id },
      { $set: { externalStatus: 'ARCHIVED', syncStatus: 'IDLE', lastSyncedAt: new Date(), lastSyncError: '' } }
    );
    log({ event: 'SHOPIFY_PRODUCT_GONE', productId: String(product._id), hidden: changed });
    return { ok: true, gone: true, changed };
  }

  const variants = shopifyProduct.variants?.nodes || [];
  const quantities = new Map();
  for (const v of variants) {
    const qty = (() => {
      const levels = v.inventoryItem?.inventoryLevels?.nodes || [];
      for (const level of levels) {
        const available = (level.quantities || []).find((q) => q.name === 'available');
        if (available && Number.isFinite(available.quantity)) return available.quantity;
      }
      return Number(v.inventoryQuantity) || 0;
    })();
    quantities.set(v.id, qty);
    if (v.inventoryItem?.id) quantities.set(v.inventoryItem.id, qty);
  }

  let changed = applyStock(product, mapping, quantities);

  // Archived or drafted upstream -> not sellable here either.
  if (shopifyProduct.status && shopifyProduct.status !== 'ACTIVE' && product.isActive) {
    product.isActive = false;
    product.status = 'Draft';
    changed = true;
  }

  if (changed) await product.save();

  // Refresh the provider's own numbers on the mapping — cost feeds margin
  // reporting, and the variant set can gain or lose entries upstream.
  const mappingVariants = (mapping.variants || []).map((link) => {
    const v = variants.find((x) => x.id === link.externalVariantId);
    if (!v) return link;
    return {
      ...link,
      externalSku: v.sku || link.externalSku,
      providerCost: v.inventoryItem?.unitCost?.amount
        ? Math.round(Number(v.inventoryItem.unitCost.amount) * 100) / 100
        : link.providerCost,
      providerPrice: Math.round(Number(v.price || 0) * 100) / 100,
      providerStock: quantities.get(link.externalVariantId) ?? link.providerStock,
    };
  });

  await ProductFulfillmentMapping.updateOne(
    { _id: mapping._id },
    {
      $set: {
        variants: mappingVariants,
        externalStatus: shopifyProduct.status || '',
        syncStatus: 'IDLE',
        lastSyncedAt: new Date(),
        lastInboundAt: new Date(),
        lastSyncError: '',
      },
    }
  );

  log({ event: 'SHOPIFY_PRODUCT_SYNCED', productId: String(product._id), trigger, changed });
  return { ok: true, changed };
}

/** products/update and products/delete */
async function handleProductWebhook(payload, { deleted = false } = {}) {
  const gid = payload?.admin_graphql_api_id || (payload?.id ? `gid://shopify/Product/${payload.id}` : null);
  if (!gid) return { handled: false, reason: 'NO_ID' };

  const mapping = await ProductFulfillmentMapping.findOne({ provider: 'SHOPIFY', externalProductId: gid });
  // Not every Shopify product is imported; most are simply not ours.
  if (!mapping) return { handled: false, reason: 'NOT_IMPORTED' };

  if (deleted) {
    const product = await Product.findById(mapping.product);
    if (product && product.isActive) {
      product.isActive = false;
      product.status = 'Draft';
      product.stock = 0;
      await product.save();
    }
    await ProductFulfillmentMapping.updateOne({ _id: mapping._id }, { $set: { externalStatus: 'ARCHIVED' } });
    log({ event: 'SHOPIFY_PRODUCT_DELETED_UPSTREAM', productId: String(mapping.product) });
    return { handled: true, hidden: true };
  }

  return { handled: true, ...(await syncMapping(mapping, { trigger: 'WEBHOOK' })) };
}

/**
 * inventory_levels/update
 *
 * The payload identifies stock by INVENTORY ITEM, not by variant or product —
 * which is why the mapping indexes externalInventoryItemId.
 */
async function handleInventoryWebhook(payload) {
  const itemId = payload?.inventory_item_id
    ? `gid://shopify/InventoryItem/${payload.inventory_item_id}`
    : payload?.admin_graphql_api_id;
  if (!itemId) return { handled: false, reason: 'NO_INVENTORY_ITEM' };

  const mapping = await ProductFulfillmentMapping.findOne({
    provider: 'SHOPIFY',
    'variants.externalInventoryItemId': itemId,
  });
  if (!mapping) return { handled: false, reason: 'NOT_IMPORTED' };

  // Re-read rather than trusting the pushed number: the payload carries one
  // location's figure, and a product stocked at several would otherwise be
  // set to the quantity of whichever location happened to change.
  return { handled: true, ...(await syncMapping(mapping, { trigger: 'INVENTORY_WEBHOOK' })) };
}

/**
 * Re-sync every mapped product. The fallback for webhooks that never arrived.
 */
async function syncAll({ limit = 100 } = {}) {
  const mappings = await ProductFulfillmentMapping.find({ provider: 'SHOPIFY' })
    .sort({ lastSyncedAt: 1 }) // stalest first
    .limit(limit);

  const summary = { checked: 0, changed: 0, failed: 0, gone: 0 };
  for (const mapping of mappings) {
    summary.checked += 1;
    try {
      const result = await syncMapping(mapping, { trigger: 'SCHEDULED' });
      if (result.gone) summary.gone += 1;
      if (result.changed) summary.changed += 1;
      if (!result.ok) summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      log({ event: 'SHOPIFY_SYNC_ERROR', mappingId: String(mapping._id), error: err.message });
    }
  }
  return summary;
}

module.exports = { syncMapping, syncAll, handleProductWebhook, handleInventoryWebhook, applyStock };
