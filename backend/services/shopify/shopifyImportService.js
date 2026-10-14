const Product = require('../../Models/Product');
const Category = require('../../Models/Category');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const ShopifySettings = require('../../Models/ShopifySettings');
const catalogService = require('./shopifyCatalogService');
const imageService = require('./shopifyImageService');
const { log } = require('./shopifyClient');
const { resolveSupplier } = require('./supplierResolver');

// Turning a Shopify product into a Krozenda one.
//
// The import is the only place the two catalogues meet, so it is where every
// mismatch between them has to be resolved: Krozenda requires a category and
// unique SKUs, Shopify requires neither; Krozenda prices in rupees per
// variant, Shopify prices per variant in the shop's currency; Krozenda stores
// its own images, Shopify serves someone else's CDN.
//
// Two rules it will not bend:
//   1. A product is imported WHOLE or not at all. A half-imported variant set
//      sells the wrong item at the wrong price, which is worse than a failed
//      import an admin can retry.
//   2. Variants are matched by Shopify's stable variant id, never by position.

class ImportError extends Error {
  constructor(message, { code = 'IMPORT_FAILED', details = null } = {}) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.details = details;
  }
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function applyRounding(amount, mode) {
  const value = Number(amount) || 0;
  if (mode === 'ROUND') return Math.round(value);

  if (mode === 'NINE_ENDING') {
    if (value < 10) return Math.round(value);
    // Snap to the NEAREST 9-ending, not the next one up.
    //
    // `floor(v / 10) * 10 + 9` — the obvious formula, and the one the previous
    // provider used — turns 130 into 139. It can only ever raise a price, by
    // up to 9, so a markup the admin configured as 30% quietly bills as 39%.
    // Nearest moves at most 5 and in whichever direction is actually closer.
    const lower = Math.floor((value + 1) / 10) * 10 - 1;
    const upper = lower + 10;
    return value - lower <= upper - value ? Math.max(0, lower) : upper;
  }

  return round2(value);
}

/**
 * The price Krozenda sells a variant at.
 *
 * MIRROR (the default) keeps Shopify's own retail price. That is the right
 * default here because the provider's app sets a sell price it expects the
 * merchant to honour, and quietly marking it up would put Krozenda's price out
 * of step with every other channel the same product is listed on.
 */
function sellingPrice(shopifyPrice, settings) {
  const base = Number(shopifyPrice) || 0;
  if (settings.pricingMode !== 'MARKUP') return round2(base);

  const type = settings.markupType === 'FLAT' ? 'FLAT' : 'PERCENT';
  const value = Math.max(0, Number(settings.markupValue) || 0);
  const marked = type === 'FLAT' ? base + value : base * (1 + value / 100);
  return applyRounding(marked, settings.priceRounding);
}

function imageUrlsOf(shopifyProduct) {
  const urls = [];
  const featured = shopifyProduct.featuredMedia?.image?.url;
  if (featured) urls.push(featured);
  for (const node of shopifyProduct.media?.nodes || []) {
    const url = node?.image?.url;
    if (url) urls.push(url);
  }
  for (const variant of shopifyProduct.variants?.nodes || []) {
    if (variant.image?.url) urls.push(variant.image.url);
  }
  return [...new Set(urls)];
}

// Shopify names a single-variant product's only variant "Default Title".
// Carrying that through would show the buyer a meaningless option picker.
function isDefaultVariant(variant, product) {
  const title = String(variant.title || '').trim().toLowerCase();
  const single = (product.variants?.nodes || []).length === 1;
  return single && (title === 'default title' || title === 'default' || title === '');
}

function variantLabel(variant) {
  const parts = (variant.selectedOptions || [])
    .filter((o) => o?.value && String(o.value).toLowerCase() !== 'default title')
    .map((o) => o.value);
  return parts.length ? parts.join(' / ') : String(variant.title || '').trim() || 'Standard';
}

function availableQuantity(variant) {
  // inventoryQuantity is the figure Shopify shows the merchant; the per-level
  // quantities are what the location actually holds. Prefer the explicit
  // "available" level when it is there, because a product stocked at several
  // locations reports a total that no single location can ship.
  const levels = variant.inventoryItem?.inventoryLevels?.nodes || [];
  for (const level of levels) {
    const available = (level.quantities || []).find((q) => q.name === 'available');
    if (available && Number.isFinite(available.quantity)) return Math.max(0, available.quantity);
  }
  return Math.max(0, Number(variant.inventoryQuantity) || 0);
}

function weightKgOf(variant) {
  const measurement = variant.inventoryItem?.measurement?.weight;
  if (!measurement || !Number.isFinite(Number(measurement.value))) return null;
  const value = Number(measurement.value);
  switch (String(measurement.unit || '').toUpperCase()) {
    case 'GRAMS':
      return round2(value / 1000);
    case 'KILOGRAMS':
      return round2(value);
    case 'OUNCES':
      return round2(value * 0.0283495);
    case 'POUNDS':
      return round2(value * 0.453592);
    default:
      return null;
  }
}

/** Strip the provider's HTML down to what Krozenda's description field holds. */
function cleanDescription(product) {
  const html = product.descriptionHtml || '';
  if (!html) return product.description || '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .trim();
}

/**
 * SKUs that would collide with something already in Krozenda.
 *
 * Krozenda's `sku` index is sparse-unique, so a clashing SKU does not fail
 * loudly on insert — it fails on the second one, after the first has been
 * written. Checking up front keeps rule 1 (whole or nothing) true.
 */
async function findSkuCollisions(skus, { excludeProductIds = [] } = {}) {
  const wanted = [...new Set(skus.filter(Boolean))];
  if (wanted.length === 0) return [];
  const clashes = await Product.find({
    sku: { $in: wanted },
    ...(excludeProductIds.length ? { _id: { $nin: excludeProductIds } } : {}),
  })
    .select('sku name')
    .lean();
  return clashes;
}

/**
 * Import one Shopify product.
 *
 * @param {object} args
 * @param {string} args.shopifyProductId  the product GID
 * @param {string} args.categoryId        required: Krozenda has no default
 * @param {string} [args.brandId]
 * @param {boolean} [args.activate]       list it immediately (default false)
 */
async function importProduct({
  shopifyProductId,
  categoryId,
  brandId = null,
  activate = false,
  adminId = null,
  // What the admin decided to sell it for. Overrides pricingMode entirely:
  // a number typed on the review screen is an explicit decision and must not
  // be second-guessed by a markup rule.
  sellingPriceOverride = null,
}) {
  const settings = await ShopifySettings.getSettings();

  const existing = await ProductFulfillmentMapping.findOne({
    provider: 'SHOPIFY',
    externalProductId: shopifyProductId,
  }).lean();
  if (existing) {
    throw new ImportError('This Shopify product has already been imported.', {
      code: 'ALREADY_IMPORTED',
      details: { productId: String(existing.product) },
    });
  }

  const category = await Category.findById(categoryId).select('_id name').lean();
  if (!category) {
    throw new ImportError('Pick a Krozenda category for this product.', { code: 'CATEGORY_REQUIRED' });
  }

  const shopifyProduct = await catalogService.getProduct(shopifyProductId);
  if (!shopifyProduct) {
    throw new ImportError('That product no longer exists in Shopify.', { code: 'NOT_FOUND_AT_PROVIDER' });
  }

  const variants = shopifyProduct.variants?.nodes || [];
  if (variants.length === 0) {
    throw new ImportError('That Shopify product has no variants, so there is nothing to sell.', {
      code: 'NO_VARIANTS',
    });
  }
  if (variants.length >= 100) {
    throw new ImportError(
      'That product has 100 or more variants, which is more than this import reads in one page. Import it manually.',
      { code: 'TOO_MANY_VARIANTS' }
    );
  }

  const simple = variants.length === 1 && isDefaultVariant(variants[0], shopifyProduct);

  // Check SKUs BEFORE writing anything (rule 1).
  const skus = variants.map((v) => v.sku).filter(Boolean);
  const duplicateWithinProduct = skus.filter((s, i) => skus.indexOf(s) !== i);
  if (duplicateWithinProduct.length > 0 && !simple) {
    throw new ImportError(
      `This product has two variants sharing the SKU "${duplicateWithinProduct[0]}". Give them distinct SKUs in Shopify, then import.`,
      { code: 'DUPLICATE_SKU_IN_PRODUCT' }
    );
  }
  const collisions = await findSkuCollisions(skus);
  if (collisions.length > 0) {
    throw new ImportError(
      `SKU "${collisions[0].sku}" is already used by "${collisions[0].name}" in Krozenda. Change it in Shopify, then import.`,
      { code: 'SKU_COLLISION', details: { collisions } }
    );
  }

  const supplier = resolveSupplier(shopifyProduct);

  const images = await imageService.importImages(imageUrlsOf(shopifyProduct));

  // Build the Krozenda shape.
  const override = Number(sellingPriceOverride);
  const hasOverride = Number.isFinite(override) && override > 0;
  // An override prices the product, not each variant: the review screen asks
  // for one number. Variants keep their relative differences by being scaled
  // against the cheapest one, so a +200 variant stays +200 more expensive.
  const providerFloor = Math.min(...variants.map((v) => Number(v.price) || 0).filter((p) => p > 0));
  const priceOf = (v) => {
    if (!hasOverride) return sellingPrice(v.price, settings);
    const delta = (Number(v.price) || 0) - providerFloor;
    return round2(override + Math.max(0, delta));
  };

  const krozendaVariants = simple
    ? []
    : variants.map((v) => ({
        name: variantLabel(v),
        sku: v.sku || '',
        barcode: v.barcode || '',
        price: priceOf(v),
        costPrice: v.inventoryItem?.unitCost?.amount ? round2(v.inventoryItem.unitCost.amount) : null,
        stock: availableQuantity(v),
        weight: weightKgOf(v),
        isActive: true,
      }));

  const prices = variants.map(priceOf).filter((p) => p > 0);
  const basePrice = prices.length ? Math.min(...prices) : 0;
  if (basePrice <= 0) {
    throw new ImportError('Every variant of that product is priced at zero in Shopify.', { code: 'NO_PRICE' });
  }

  const totalStock = simple ? availableQuantity(variants[0]) : krozendaVariants.reduce((s, v) => s + v.stock, 0);
  const firstCost = variants[0]?.inventoryItem?.unitCost?.amount;

  // Shopify's compare-at price is the struck-through "was" price. Carried
  // over as MRP so a discount Krozenda shows is one the provider actually
  // claims, not one invented here.
  const compareAt = Number(variants[0]?.compareAtPrice) || 0;

  const product = await Product.create({
    name: shopifyProduct.title,
    sku: simple ? variants[0].sku || undefined : undefined,
    barcode: simple ? variants[0].barcode || undefined : undefined,
    category: category._id,
    brand: brandId || null,
    vendor: null, // platform-owned: there is no seller behind an imported product
    fulfillmentProvider: 'SHOPIFY',
    price: basePrice,
    mrp: compareAt > basePrice ? round2(compareAt) : null,
    costPrice: firstCost ? round2(firstCost) : null,
    stock: totalStock,
    weight: simple ? weightKgOf(variants[0]) : null,
    images,
    description: cleanDescription(shopifyProduct),
    shortDescription: String(shopifyProduct.description || '').slice(0, 300),
    variants: krozendaVariants,
    // The shop's prices include tax, so Krozenda's must be read the same way
    // or the GST would be added a second time on top of a price that already
    // has it.
    gstInclusive: settings.shopTaxesIncluded !== false,
    // Imported products are admin-owned, so they skip the seller approval
    // queue — but they are listed only when the admin says so.
    approvalStatus: 'APPROVED',
    isActive: Boolean(activate),
    status: activate ? 'Active' : 'Draft',
  });

  // Link variants by Shopify's stable id. Matching by array position is what
  // the previous provider did and it is unsafe: anything that reorders the
  // array silently re-points every mapping one place along.
  const mappingVariants = variants.map((v, index) => ({
    krozendaVariantId: simple ? null : product.variants[index]?._id || null,
    externalVariantId: v.id,
    externalSku: v.sku || '',
    externalInventoryItemId: v.inventoryItem?.id || '',
    externalLocationId: v.inventoryItem?.inventoryLevels?.nodes?.[0]?.location?.id || settings.primaryLocationId || '',
    providerCost: v.inventoryItem?.unitCost?.amount ? round2(v.inventoryItem.unitCost.amount) : null,
    providerPrice: round2(v.price),
    providerStock: availableQuantity(v),
  }));

  if (!simple && mappingVariants.some((m) => !m.krozendaVariantId)) {
    // Should be impossible, but a mapping with a hole in it mis-sells, so it
    // is checked rather than assumed. Undo the product and refuse.
    await Product.deleteOne({ _id: product._id });
    throw new ImportError('Could not link every variant. Nothing was imported.', { code: 'VARIANT_LINK_FAILED' });
  }

  try {
    await ProductFulfillmentMapping.create({
      product: product._id,
      provider: 'SHOPIFY',
      externalProductId: shopifyProduct.id,
      externalHandle: shopifyProduct.handle || '',
      externalStatus: shopifyProduct.status || '',
      externalSupplier: supplier.code,
      externalSupplierSource: supplier.confidence,
      externalProductType: shopifyProduct.productType || '',
      shopDomain: settings.shopDomain,
      currency: settings.shopCurrency || 'INR',
      taxesIncluded: settings.shopTaxesIncluded !== false,
      variants: mappingVariants,
      origin: 'IMPORTED_FROM_SHOPIFY',
      inventoryOwner: 'SHOPIFY',
      lastSyncedAt: new Date(),
      onboardedBy: adminId,
    });
  } catch (err) {
    // The unique (provider, externalProductId) index is the race guard: two
    // admins clicking import at the same moment produce one product, not two.
    await Product.deleteOne({ _id: product._id });
    if (err.code === 11000) {
      throw new ImportError('This Shopify product has already been imported.', { code: 'ALREADY_IMPORTED' });
    }
    throw err;
  }

  log({
    event: 'SHOPIFY_PRODUCT_IMPORTED',
    productId: String(product._id),
    externalProductId: shopifyProduct.id,
    supplier: supplier.code,
    variants: variants.length,
    images: images.length,
    stock: totalStock,
  });

  return {
    product,
    warnings: [
      ...(images.length === 0 ? ['No images could be copied from Shopify for this product.'] : []),
      ...(totalStock === 0
        ? ['Shopify reports zero stock for this product, so buyers will see it as out of stock.']
        : []),
    ],
  };
}

/**
 * Import several, reporting each outcome.
 *
 * Sequential, and one failure never stops the rest: importing nine of ten and
 * saying which one failed is more useful than stopping at the first problem.
 */
async function importProducts({ items = [], adminId = null }) {
  const results = [];
  for (const item of items) {
    try {
      const { product, warnings } = await importProduct({ ...item, adminId });
      results.push({
        shopifyProductId: item.shopifyProductId,
        ok: true,
        productId: String(product._id),
        name: product.name,
        warnings,
      });
    } catch (err) {
      results.push({
        shopifyProductId: item.shopifyProductId,
        ok: false,
        code: err.code || 'IMPORT_FAILED',
        message: err.message,
      });
    }
  }
  return results;
}

module.exports = {
  importProduct,
  importProducts,
  ImportError,
  sellingPrice,
  variantLabel,
  availableQuantity,
  weightKgOf,
  isDefaultVariant,
  findSkuCollisions,
};
