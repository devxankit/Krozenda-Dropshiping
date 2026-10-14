const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Category = require('../Models/Category');
const ProductFulfillmentMapping = require('../Models/ProductFulfillmentMapping');
const ShopifySettings = require('../Models/ShopifySettings');
const ShopifyOrderPush = require('../Models/ShopifyOrderPush');
const Order = require('../Models/Order');
const orderPushService = require('../services/shopify/orderPushService');
const webhookRegistrationService = require('../services/shopify/webhookRegistrationService');
const inboundCatalogSync = require('../services/shopify/inboundCatalogSync');
const supplierReportService = require('../services/shopify/supplierReportService');
const catalogService = require('../services/shopify/shopifyCatalogService');
const { resolveSupplier, labelOf } = require('../services/shopify/supplierResolver');
const importService = require('../services/shopify/shopifyImportService');

// Admin > Shopify > Catalogue. Browse what is in Shopify, and bring it across.

function fail(res, status, message, code) {
  return res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
}

// What the browse screen shows for each Shopify product. Deliberately not the
// raw Shopify object: the admin needs to decide whether to import, which takes
// price, stock, variant count and whether it is already here.
function serializeShopifyProduct(product, importedByExternalId) {
  const variants = product.variants?.nodes || [];
  const prices = variants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
  const imported = importedByExternalId.get(product.id) || null;
  const supplier = resolveSupplier(product);

  return {
    id: product.id,
    title: product.title,
    supplier: supplier.code,
    supplierLabel: supplier.label,
    // Dropship India fills this in and vFulfill does not; it is the best hint
    // available for which Krozenda category a product belongs in.
    productTypeHint: product.productType || '',
    handle: product.handle,
    status: product.status,
    productType: product.productType || '',
    vendor: product.vendor || '',
    image: product.featuredMedia?.image?.url || product.media?.nodes?.[0]?.image?.url || null,
    imageCount: (product.media?.nodes || []).filter((n) => n?.image?.url).length,
    // The browse query fetches only the first few variants (cost), so the
    // real count comes from Shopify's own counter rather than from how many
    // happened to be returned.
    variantCount: product.variantsCount?.count ?? variants.length,
    priceFrom: prices.length ? Math.min(...prices) : 0,
    priceTo: prices.length ? Math.max(...prices) : 0,
    totalInventory: Number(product.totalInventory) || 0,
    unitCost: variants[0]?.inventoryItem?.unitCost?.amount
      ? Number(variants[0].inventoryItem.unitCost.amount)
      : null,
    skus: variants.map((v) => v.sku).filter(Boolean),
    updatedAt: product.updatedAt,
    // The single most useful fact on this screen.
    imported: Boolean(imported),
    krozendaProductId: imported ? String(imported.product) : null,
  };
}

// GET /admin/shopify/catalogue
async function browseCatalogue(req, res) {
  const settings = await ShopifySettings.getSettings();
  if (settings.status !== 'CONNECTED') {
    return fail(res, 409, 'Connect Shopify before browsing its catalogue.', 'NOT_CONNECTED');
  }

  const { cursor = null, limit = 25, search = '' } = req.query;

  try {
    const page = await catalogService.listProducts({
      limit: Number(limit) || 25,
      cursor: cursor || null,
      search: String(search || '').trim(),
    });

    // One query for the whole page rather than one per product.
    const ids = page.products.map((p) => p.id);
    const mappings = await ProductFulfillmentMapping.find({ provider: 'SHOPIFY', externalProductId: { $in: ids } })
      .select('product externalProductId')
      .lean();
    const byExternalId = new Map(mappings.map((m) => [m.externalProductId, m]));

    return res.json({
      success: true,
      message: 'Shopify catalogue fetched',
      data: {
        products: page.products.map((p) => serializeShopifyProduct(p, byExternalId)),
        hasNextPage: page.hasNextPage,
        cursor: page.cursor,
      },
    });
  } catch (err) {
    return fail(res, 502, `Shopify could not be read: ${err.message}`, err.code || 'PROVIDER_ERROR');
  }
}

// GET /admin/shopify/catalogue/count
async function catalogueCount(req, res) {
  try {
    const count = await catalogService.countProducts();
    const imported = await ProductFulfillmentMapping.countDocuments({ provider: 'SHOPIFY' });
    return res.json({ success: true, message: 'Counts fetched', data: { shopifyProducts: count, imported } });
  } catch (err) {
    return fail(res, 502, `Shopify could not be read: ${err.message}`, 'PROVIDER_ERROR');
  }
}

// GET /admin/shopify/catalogue/:id  (id is a URL-encoded Shopify GID)
async function getCatalogueProduct(req, res) {
  const shopifyProductId = decodeURIComponent(req.params.id);
  try {
    const product = await catalogService.getProduct(shopifyProductId);
    if (!product) return fail(res, 404, 'That product no longer exists in Shopify.', 'NOT_FOUND_AT_PROVIDER');

    const mapping = await ProductFulfillmentMapping.findOne({
      provider: 'SHOPIFY',
      externalProductId: shopifyProductId,
    })
      .select('product')
      .lean();

    return res.json({
      success: true,
      message: 'Product fetched',
      data: {
        ...serializeShopifyProduct(product, new Map(mapping ? [[shopifyProductId, mapping]] : [])),
        descriptionHtml: product.descriptionHtml || '',
        options: product.options || [],
        variants: (product.variants?.nodes || []).map((v) => ({
          id: v.id,
          title: v.title,
          sku: v.sku || '',
          price: Number(v.price) || 0,
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
          available: importService.availableQuantity(v),
          unitCost: v.inventoryItem?.unitCost?.amount ? Number(v.inventoryItem.unitCost.amount) : null,
          weightKg: importService.weightKgOf(v),
          label: importService.variantLabel(v),
        })),
      },
    });
  } catch (err) {
    return fail(res, 502, `Shopify could not be read: ${err.message}`, 'PROVIDER_ERROR');
  }
}

// POST /admin/shopify/catalogue/import
//
// body: { items: [{ shopifyProductId, categoryId, brandId?, activate? }] }
//   or: { shopifyProductId, categoryId, brandId?, activate? }
async function importFromCatalogue(req, res) {
  const settings = await ShopifySettings.getSettings();
  if (settings.status !== 'CONNECTED') {
    return fail(res, 409, 'Connect Shopify before importing.', 'NOT_CONNECTED');
  }

  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : body.shopifyProductId ? [body] : [];
  if (items.length === 0) return fail(res, 400, 'Pick at least one product to import.');
  if (items.length > 50) {
    return fail(res, 400, 'Import at most 50 products at a time, so a failure is easy to see and retry.');
  }

  const normalized = [];
  for (const item of items) {
    const categoryId = item.categoryId || settings.defaultCategory;
    if (!item.shopifyProductId) return fail(res, 400, 'Each item needs a shopifyProductId.');
    if (!categoryId) {
      return fail(
        res,
        400,
        'Pick a category for each product (or set a default category in Shopify settings).',
        'CATEGORY_REQUIRED'
      );
    }
    if (!mongoose.isValidObjectId(categoryId)) return fail(res, 400, `"${categoryId}" is not a valid category id.`);
    normalized.push({
      shopifyProductId: item.shopifyProductId,
      categoryId,
      brandId: item.brandId && mongoose.isValidObjectId(item.brandId) ? item.brandId : null,
      activate: item.activate === true,
      sellingPriceOverride: item.sellingPrice != null ? Number(item.sellingPrice) : null,
    });
  }

  const results = await importService.importProducts({ items: normalized, adminId: req.admin?._id || null });
  const imported = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  return res.status(failed.length && !imported.length ? 422 : 200).json({
    success: imported.length > 0,
    message:
      failed.length === 0
        ? `Imported ${imported.length} product(s).`
        : `Imported ${imported.length}, ${failed.length} could not be imported.`,
    data: { results, importedCount: imported.length, failedCount: failed.length },
  });
}

// GET /admin/shopify/products — what has been imported, from Krozenda's side
async function listImported(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  const mappings = await ProductFulfillmentMapping.find({ provider: 'SHOPIFY' })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const products = await Product.find({ _id: { $in: mappings.map((m) => m.product) } })
    .select('name price stock images isActive status category variants')
    .populate('category', 'name')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return res.json({
    success: true,
    message: 'Imported products fetched',
    data: {
      products: mappings.map((m) => {
        const p = byId.get(String(m.product));
        return {
          mappingId: String(m._id),
          productId: String(m.product),
          name: p?.name || '(deleted in Krozenda)',
          price: p?.price ?? null,
          stock: p?.stock ?? null,
          image: p?.images?.[0] || null,
          category: p?.category?.name || '',
          isActive: p?.isActive ?? false,
          status: p?.status || '',
          variantCount: (p?.variants || []).length,
          externalProductId: m.externalProductId,
          supplier: m.externalSupplier || 'UNKNOWN',
          supplierLabel: labelOf(m.externalSupplier),
          externalHandle: m.externalHandle,
          externalStatus: m.externalStatus,
          syncStatus: m.syncStatus,
          lastSyncedAt: m.lastSyncedAt,
          lastSyncError: m.lastSyncError,
        };
      }),
      page,
      limit,
      total: await ProductFulfillmentMapping.countDocuments({ provider: 'SHOPIFY' }),
    },
  });
}


// PATCH /admin/shopify/products/:productId
//
// The review step: set the price the admin wants to sell at, move it between
// categories, and decide whether buyers can see it.
async function updateImportedProduct(req, res) {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return fail(res, 400, 'Invalid product id.');

  const mapping = await ProductFulfillmentMapping.findOne({ provider: 'SHOPIFY', product: productId }).lean();
  if (!mapping) return fail(res, 404, 'That product was not imported from Shopify.', 'NOT_IMPORTED');

  const product = await Product.findById(productId);
  if (!product) return fail(res, 404, 'Product not found.');

  const { price, mrp, categoryId, brandId, isActive, name, description } = req.body || {};
  const changes = [];

  if (price != null) {
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return fail(res, 400, 'Price must be a number greater than zero.');

    // Selling below what the supplier charges loses money on every sale, so it
    // is refused rather than warned about. The cost is the provider's own
    // figure, so this check cannot be wrong in Krozenda's favour.
    const cost = Number(product.costPrice) || 0;
    if (cost > 0 && value < cost && req.body.allowBelowCost !== true) {
      return fail(
        res,
        422,
        `${value} is below the ${cost} this product costs from the supplier. Confirm to sell at a loss deliberately.`,
        'BELOW_COST'
      );
    }

    product.price = Math.round(value * 100) / 100;
    changes.push('price');
  }

  if (mrp !== undefined) {
    const value = mrp === null || mrp === '' ? null : Number(mrp);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return fail(res, 400, 'MRP must be a number.');
    if (value !== null && value > 0 && value < product.price) {
      return fail(res, 400, 'MRP cannot be below the selling price — that would show a negative discount.');
    }
    product.mrp = value;
    changes.push('mrp');
  }

  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) return fail(res, 400, 'Invalid category id.');
    const category = await Category.findById(categoryId).select('_id').lean();
    if (!category) return fail(res, 404, 'That category does not exist.');
    product.category = category._id;
    changes.push('category');
  }

  if (brandId !== undefined) {
    if (brandId && !mongoose.isValidObjectId(brandId)) return fail(res, 400, 'Invalid brand id.');
    product.brand = brandId || null;
    changes.push('brand');
  }

  if (typeof name === 'string' && name.trim()) {
    product.name = name.trim();
    changes.push('name');
  }
  if (typeof description === 'string') {
    product.description = description;
    changes.push('description');
  }

  if (typeof isActive === 'boolean') {
    // Going live with no stock puts a product in front of buyers that none of
    // them can buy. Allowed, but only when asked for explicitly.
    if (isActive && product.stock <= 0 && req.body.allowOutOfStock !== true) {
      return fail(
        res,
        422,
        'This product has no stock, so buyers would see it as unavailable. Confirm to publish it anyway.',
        'NO_STOCK'
      );
    }
    product.isActive = isActive;
    product.status = isActive ? 'Active' : 'Draft';
    changes.push(isActive ? 'published' : 'unpublished');
  }

  if (changes.length === 0) return fail(res, 400, 'Nothing to change.');
  await product.save();

  return res.json({
    success: true,
    message: changes.includes('published')
      ? 'Product is live for customers.'
      : changes.includes('unpublished')
        ? 'Product hidden from customers.'
        : 'Product updated.',
    data: {
      productId: String(product._id),
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      stock: product.stock,
      isActive: product.isActive,
      status: product.status,
      changed: changes,
    },
  });
}

// POST /admin/shopify/products/bulk — publish or unpublish several at once.
async function bulkUpdateImported(req, res) {
  const { productIds = [], isActive, allowOutOfStock = false } = req.body || {};
  if (!Array.isArray(productIds) || productIds.length === 0) return fail(res, 400, 'Pick at least one product.');
  if (typeof isActive !== 'boolean') return fail(res, 400, 'isActive must be true or false.');
  if (productIds.length > 200) return fail(res, 400, 'At most 200 products at a time.');

  const ids = productIds.filter((id) => mongoose.isValidObjectId(id));
  const mappings = await ProductFulfillmentMapping.find({ provider: 'SHOPIFY', product: { $in: ids } })
    .select('product')
    .lean();
  const importedIds = mappings.map((m) => m.product);

  const query = { _id: { $in: importedIds } };
  // Publishing skips the ones with no stock unless asked, rather than failing
  // the whole batch because of one of them.
  if (isActive && !allowOutOfStock) query.stock = { $gt: 0 };

  const result = await Product.updateMany(query, { $set: { isActive, status: isActive ? 'Active' : 'Draft' } });

  const skipped = importedIds.length - result.modifiedCount;
  return res.json({
    success: true,
    message: isActive
      ? `${result.modifiedCount} product(s) are live${skipped > 0 ? `, ${skipped} skipped for having no stock` : ''}.`
      : `${result.modifiedCount} product(s) hidden from customers.`,
    data: { updated: result.modifiedCount, skipped, requested: productIds.length },
  });
}

// DELETE /admin/shopify/products/:productId — remove it from Krozenda.
//
// Only ever touches Krozenda. The product stays in Shopify and can be
// imported again afterwards.
async function removeImportedProduct(req, res) {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) return fail(res, 400, 'Invalid product id.');

  const mapping = await ProductFulfillmentMapping.findOne({ provider: 'SHOPIFY', product: productId });
  if (!mapping) return fail(res, 404, 'That product was not imported from Shopify.', 'NOT_IMPORTED');

  // A product that has been ordered is part of the record. Orders snapshot
  // their own lines so deleting it would not corrupt them, but it would break
  // every "buy it again" and order-detail link pointing at it.
  const Order = require('../Models/Order');
  const ordered = await Order.countDocuments({ 'items.product': productId });
  if (ordered > 0) {
    return fail(
      res,
      409,
      `This product appears on ${ordered} order(s), so it is kept. Hide it from customers instead.`,
      'HAS_ORDERS'
    );
  }

  await Product.deleteOne({ _id: productId });
  await ProductFulfillmentMapping.deleteOne({ _id: mapping._id });

  return res.json({ success: true, message: 'Removed from Krozenda. It is still in your Shopify store.', data: null });
}


// PUT /admin/shopify/settings/fulfilment
//
// Delivery rates, the cancel window, and the test-order switch. These decide
// what a buyer is charged for delivery and how long they can change their
// mind, so each one is validated rather than merged blindly.
async function updateFulfilmentSettings(req, res) {
  const settings = await ShopifySettings.getSettings();
  const { shippingRules, orderPushGraceMinutes, pushAsTestOrders } = req.body || {};
  const changed = [];

  if (shippingRules && typeof shippingRules === 'object') {
    const MODES = ['FLAT_PER_ORDER', 'PER_ITEM', 'FLAT_PLUS_PER_ITEM', 'FREE'];
    const mode = shippingRules.mode || settings.shippingRules?.mode || 'FLAT_PER_ORDER';
    if (!MODES.includes(mode)) return fail(res, 400, `Delivery mode must be one of: ${MODES.join(', ')}.`);

    const num = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };

    settings.shippingRules = {
      // Explicit, never inferred: turning this on is the act that allows
      // these products to be sold at all, so it must be a decision.
      configured: shippingRules.configured === true,
      mode,
      flatAmount: num(shippingRules.flatAmount, settings.shippingRules?.flatAmount || 0),
      perItemAmount: num(shippingRules.perItemAmount, settings.shippingRules?.perItemAmount || 0),
      freeAboveCartValue: num(shippingRules.freeAboveCartValue, settings.shippingRules?.freeAboveCartValue || 0),
      estimatedDeliveryDays: Math.max(
        1,
        num(shippingRules.estimatedDeliveryDays, settings.shippingRules?.estimatedDeliveryDays || 7)
      ),
      label: String(shippingRules.label || settings.shippingRules?.label || 'Standard delivery').slice(0, 60),
    };
    changed.push('shippingRules');
  }

  if (orderPushGraceMinutes !== undefined) {
    const minutes = Number(orderPushGraceMinutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      return fail(res, 400, 'The cancel window must be between 0 and 1440 minutes.');
    }
    settings.orderPushGraceMinutes = minutes;
    changed.push('orderPushGraceMinutes');
  }

  if (typeof pushAsTestOrders === 'boolean') {
    settings.pushAsTestOrders = pushAsTestOrders;
    changed.push('pushAsTestOrders');
  }

  if (changed.length === 0) return fail(res, 400, 'Nothing to change.');
  settings.updatedBy = req.admin?._id || null;
  await settings.save();

  return res.json({ success: true, message: 'Fulfilment settings saved.', data: settings.toSafeJSON() });
}

// GET /admin/shopify/order-pushes
//
// The operational screen that matters most: a FAILED or ABANDONED row is money
// taken for goods no supplier has been asked to ship.
async function listOrderPushes(req, res) {
  const { status } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  const query = status ? { status: String(status).toUpperCase() } : {};
  const [rows, total, counts] = await Promise.all([
    ShopifyOrderPush.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ShopifyOrderPush.countDocuments(query),
    ShopifyOrderPush.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  const orders = await Order.find({ _id: { $in: rows.map((r) => r.order) } })
    .select('total status paymentStatus createdAt')
    .lean();
  const byId = new Map(orders.map((o) => [String(o._id), o]));

  return res.json({
    success: true,
    message: 'Order pushes fetched',
    data: {
      pushes: rows.map((r) => {
        const order = byId.get(String(r.order));
        return {
          id: String(r._id),
          orderId: String(r.order),
          supplier: r.supplier,
          supplierLabel: r.supplierLabel || r.supplier,
          lineCount: (r.productIds || []).length,
          subtotal: r.subtotal,
          shippingFee: r.shippingFee,
          providerCost: r.providerCost,
          status: r.status,
          dueAt: r.dueAt,
          attempts: r.attempts,
          nextAttemptAt: r.nextAttemptAt,
          lastError: r.lastError,
          lastErrorCode: r.lastErrorCode,
          shopifyOrderId: r.shopifyOrderId,
          shopifyOrderName: r.shopifyOrderName,
          pushedAt: r.pushedAt,
          test: r.test,
          cancelledBy: r.cancelledBy,
          orderTotal: order?.total ?? null,
          orderStatus: order?.status ?? null,
          paymentStatus: order?.paymentStatus ?? null,
          placedAt: order?.createdAt ?? null,
        };
      }),
      counts: counts.reduce((acc, c) => ({ ...acc, [c._id]: c.n }), {}),
      page,
      limit,
      total,
    },
  });
}

// POST /admin/shopify/order-pushes/:orderId/retry
async function retryOrderPush(req, res) {
  const { orderId } = req.params;
  if (!mongoose.isValidObjectId(orderId)) return fail(res, 400, 'Invalid order id.');

  const result = await orderPushService.retry({ orderId });
  if (!result.ok) return fail(res, result.status || 400, result.message);
  return res.json({ success: true, message: 'Sent to Shopify again.', data: result.result });
}

// POST /admin/shopify/order-pushes/run-now — drain the queue without waiting
// for the next tick. For verifying a fix immediately.
async function runPushNow(req, res) {
  const summary = await orderPushService.drain();
  return res.json({ success: true, message: 'Queue drained.', data: summary });
}

// GET /admin/shopify/webhooks — what Shopify will actually send us.
//
// Nothing subscribed means the integration is one-way: orders go out and no
// fulfilment, tracking or stock change ever comes back.
async function getWebhookHealth(req, res) {
  try {
    const health = await webhookRegistrationService.health();
    return res.json({ success: true, message: 'Webhook health fetched', data: health });
  } catch (err) {
    return fail(res, 502, `Could not read webhooks from Shopify: ${err.message}`, err.code);
  }
}

// POST /admin/shopify/webhooks/register
async function registerWebhooks(req, res) {
  try {
    const result = await webhookRegistrationService.register({
      baseUrl: req.body?.baseUrl || null,
      adminId: req.admin?._id || null,
    });
    return res.json({
      success: result.failed === 0,
      message:
        result.failed === 0
          ? `Subscribed to ${result.registered} topic(s).`
          : `Subscribed to ${result.registered}, ${result.failed} failed.`,
      data: result,
    });
  } catch (err) {
    return fail(res, 400, err.message, err.code);
  }
}

// DELETE /admin/shopify/webhooks
async function unregisterWebhooks(req, res) {
  try {
    const result = await webhookRegistrationService.unregister({ adminId: req.admin?._id || null });
    return res.json({ success: true, message: `Removed ${result.removed} subscription(s).`, data: result });
  } catch (err) {
    return fail(res, 502, err.message, err.code);
  }
}

// POST /admin/shopify/products/sync — re-read stock and status now.
async function syncImportedProducts(req, res) {
  const products = await inboundCatalogSync.syncAll({ limit: Number(req.body?.limit) || 100 });
  // Order status as well: without a public webhook address this is the only
  // way a shipped order stops showing as pending to the buyer.
  const orders = await require('../services/shopify/inboundOrderSync').pollOpenOrders({ limit: 50 });
  return res.json({
    success: true,
    message:
      `Checked ${products.checked} product(s) and ${orders.checked} open order(s); ` +
      `${products.changed + orders.changed} updated.`,
    data: { products, orders },
  });
}


// GET /admin/shopify/suppliers — earnings per dropshipping platform.
async function getSupplierEarnings(req, res) {
  const { start, end } = req.query;
  const data = await supplierReportService.supplierEarnings({ start, end });
  return res.json({ success: true, message: 'Supplier earnings fetched', data });
}

// GET /admin/shopify/payment-exceptions
//
// Every state where money is somewhere it should not be. Each has its own
// remedy, so they are counted separately rather than as one number.
async function getPaymentExceptions(req, res) {
  const data = await supplierReportService.paymentExceptions();
  const total = Object.values(data).reduce((sum, group) => sum + (group.count || 0), 0);
  return res.json({
    success: true,
    message: total === 0 ? 'No payment exceptions.' : `${total} payment exception(s) need attention.`,
    data: { ...data, total },
  });
}

module.exports = {
  browseCatalogue,
  catalogueCount,
  getCatalogueProduct,
  importFromCatalogue,
  listImported,
  updateImportedProduct,
  bulkUpdateImported,
  removeImportedProduct,
  updateFulfilmentSettings,
  listOrderPushes,
  retryOrderPush,
  runPushNow,
  getWebhookHealth,
  registerWebhooks,
  unregisterWebhooks,
  syncImportedProducts,
  getSupplierEarnings,
  getPaymentExceptions,
};
