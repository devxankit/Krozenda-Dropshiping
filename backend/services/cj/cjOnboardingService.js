const mongoose = require('mongoose');
const Product = require('../../Models/Product');
const Category = require('../../Models/Category');
const CjCategoryMapping = require('../../Models/CjCategoryMapping');
const CjSettings = require('../../Models/CjSettings');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const cjProductService = require('./cjProductService');
const cjImageService = require('./cjImageService');
const { usdToInr, parseCjPrice, applyPriceRounding, calculateMarkupPrice } = require('./cjPricing');

// Phase 3 — Selected Product Onboarding.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: onboarding touches exactly ONE CJ
// product at a time, chosen by the admin from the live catalogue (Phase 2).
// There is no "import all" here and there never should be — see master plan
// §2. The customer never sees CJ at request time: this is the one place CJ
// data crosses into Krozenda's own DB, and everything after this point
// (storefront, cart, checkout) reads Product/ProductFulfillmentMapping only.

// CJ's `description` field is raw HTML meant for its own supplier-facing
// listing tools — <p>/<b>/<br/> markup, a "Packing list" section, and bare
// <img> tags with no alt text. Krozenda's product detail page deliberately
// renders description as PLAIN TEXT, never dangerouslySetInnerHTML (a
// correct, intentional anti-XSS decision — see ProductDetailScreen.jsx), so
// passing CJ's HTML straight through means the customer sees literal
// "<p><b>Product information:</b>" tags instead of readable text. This
// strips it down to plain, readable text instead of fixing the symptom by
// weakening the frontend's XSS protection.
function cleanCjDescription(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class OnboardingError extends Error {
  constructor(message, { status = 400, code = 'ONBOARDING_ERROR' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Manual: admin supplies sellingPrice directly (already in ₹), per variant.
// Automatic: sellingPrice = (providerCost + providerShippingCost, converted
// USD -> ₹) + margin. providerCost/providerShippingCost are CJ's own
// quotes and always arrive in USD — see cjPricing.js for why the conversion
// has to happen here rather than being skipped.
function computeSellingPrice({
  pricingMode,
  marginRule,
  providerCost,
  providerShippingCost,
  manualPrice,
  defaultMarkupPercent = 30,
  priceRounding = 'NONE',
}) {
  if (pricingMode === 'MANUAL') {
    if (typeof manualPrice !== 'number' || manualPrice <= 0) {
      throw new OnboardingError('A positive sellingPrice is required for manual pricing');
    }
    return manualPrice;
  }

  const cost = usdToInr(providerCost);
  const shipping = usdToInr(providerShippingCost);
  const base = cost + shipping;

  const rule = marginRule && typeof marginRule.value === 'number'
    ? marginRule
    : { type: 'PERCENT', value: defaultMarkupPercent };

  const margin = rule.type === 'FLAT' ? rule.value : base * (rule.value / 100);
  return applyPriceRounding(base + margin, priceRounding);
}

// Resolves a CJ category to a Krozenda category, preferring an existing
// saved mapping (hardening req #6) over the one-off id the admin passes for
// this onboarding call.
async function resolveKrozendaCategory({ cjCategoryId, krozendaCategoryId }) {
  if (krozendaCategoryId) {
    const category = await Category.findById(krozendaCategoryId);
    if (!category) throw new OnboardingError('krozendaCategoryId does not match an existing category');
    return category;
  }

  if (cjCategoryId) {
    const mapping = await CjCategoryMapping.findOne({ cjCategoryId, active: true }).populate('krozendaCategory');
    if (mapping?.krozendaCategory) return mapping.krozendaCategory;
  }

  throw new OnboardingError('No Krozenda category resolved — pass krozendaCategoryId or save a category mapping first');
}

// `variantSelections` (optional): [{ cjVariantId, sellingPrice? }] — lets the
// admin onboard only some of CJ's variants, and set a manual price per one.
// When omitted, every CJ variant is onboarded.
async function onboardProduct(
  {
    cjProductId,
    krozendaCategoryId,
    brand = null,
    pricingMode = 'MANUAL',
    marginRule = null,
    sellingPrice, // used for a simple, variant-less product under MANUAL mode
    variantSelections = null,
    description,
    priceRounding = null,
    onboardedBy = null,
  },
  { onLog } = {}
) {
  if (!cjProductId) throw new OnboardingError('cjProductId is required');

  const existing = await ProductFulfillmentMapping.findOne({ provider: 'CJ', cjProductId });
  if (existing) {
    throw new OnboardingError('This CJ product has already been onboarded', { code: 'ALREADY_ONBOARDED' });
  }

  const [detail, cjVariants, globalSettings] = await Promise.all([
    cjProductService.getProductDetail(cjProductId, { onLog }),
    cjProductService.getProductVariants(cjProductId, { onLog }),
    CjSettings.getSettings(),
  ]);

  if (!detail) throw new OnboardingError('CJ product not found', { status: 404 });

  const defaultMarkupPercent = globalSettings?.defaultMarkupPercent ?? 30;
  const effectivePriceRounding = priceRounding || globalSettings?.priceRounding || 'ROUND';

  const category = await resolveKrozendaCategory({ cjCategoryId: detail.categoryId, krozendaCategoryId });

  const selectedIds = variantSelections ? new Set(variantSelections.map((v) => v.cjVariantId)) : null;
  const manualPriceByVariant = new Map(
    (variantSelections || []).filter((v) => v.sellingPrice != null).map((v) => [v.cjVariantId, v.sellingPrice])
  );

  const chosenVariants = (cjVariants || []).filter((v) => !selectedIds || selectedIds.has(v.vid || v.variantId));
  if (chosenVariants.length === 0 && (cjVariants || []).length > 0) {
    throw new OnboardingError('No matching CJ variants selected');
  }

  // A CJ product with real variants (color/size) becomes a Product with
  // productVariantSchema subdocuments; a CJ product with none is a simple
  // product priced directly.
  const hasVariants = chosenVariants.length > 0;

  const productVariants = [];
  const mappingVariants = [];

  const variantResults = await Promise.all(
    chosenVariants.map(async (cv) => {
      const cjVariantId = cv.vid || cv.variantId;
      const providerCost = parseCjPrice(cv.variantSellPrice ?? cv.sellPrice);
      const providerShippingCost = Number(cv.logisticPrice ?? 0) || 0;

      const [providerStock, variantImage] = await Promise.all([
        cjProductService.getVariantTotalStock(cjVariantId, { onLog }).catch(() => 0),
        cv.variantImage ? cjImageService.importCjImage(cv.variantImage).catch(() => null) : Promise.resolve(null),
      ]);

      const price = computeSellingPrice({
        pricingMode,
        marginRule,
        providerCost,
        providerShippingCost,
        manualPrice: manualPriceByVariant.get(cjVariantId) ?? (hasVariants ? undefined : sellingPrice),
        defaultMarkupPercent,
        priceRounding: effectivePriceRounding,
      });

      const variantName =
        cv.variantNameEn || [cv.variantKey, cv.variantValue].filter(Boolean).join(' / ') || cjVariantId;

      return {
        productVariant: {
          name: variantName,
          sku: cv.variantSku || '',
          price,
          stock: providerStock,
          image: variantImage,
          isActive: true,
        },
        mappingVariant: {
          krozendaVariantId: null,
          cjVariantId,
          cjSku: cv.variantSku || '',
          providerCost,
          providerShippingCost,
          providerStock,
        },
      };
    })
  );

  for (const vr of variantResults) {
    productVariants.push(vr.productVariant);
    mappingVariants.push(vr.mappingVariant);
  }

  const basePrice = hasVariants
    ? Math.min(...productVariants.map((v) => v.price))
    : computeSellingPrice({
        pricingMode,
        marginRule,
        providerCost: parseCjPrice(detail.sellPrice),
        providerShippingCost: parseCjPrice(detail.logisticPrice),
        manualPrice: sellingPrice,
        defaultMarkupPercent,
        priceRounding: effectivePriceRounding,
      });

  const baseStock = hasVariants
    ? productVariants.reduce((sum, v) => sum + v.stock, 0)
    : Number(detail.productStock ?? 0) || 0;

  // Import-time only (never at browse time — see cjImageService's own
  // comment on why): CJ's raw CDN URLs never enter Product.images. Each one
  // is downloaded, validated and re-encoded through the same WebP pipeline
  // every other product photo in this codebase goes through, so a CJ
  // product's images behave identically to an admin-uploaded one downstream
  // (srcset, getImageUrl, everything) — no CJ-specific serving path needed.
  // A failed image download never fails the whole onboarding.
  const rawImageUrls = Array.isArray(detail.productImageSet)
    ? detail.productImageSet
    : detail.productImage
      ? [detail.productImage]
      : [];
  const optimizedImages = await cjImageService.importCjImages(rawImageUrls);

  const product = await Product.create({
    name: detail.productNameEn || detail.productName || `CJ Product ${cjProductId}`,
    category: category._id,
    brand,
    vendor: null, // CJ products are always admin-owned (master plan §1)
    price: basePrice,
    stock: baseStock,
    images: optimizedImages,
    description: description || cleanCjDescription(detail.description) || detail.productNameEn || '',
    variants: productVariants,
    isActive: true,
    fulfillmentProvider: 'CJ',
  });

  // Back-fill the Krozenda variant _ids CJ has no concept of, now that
  // Product.create() has assigned them, matching by array position.
  product.variants.forEach((v, idx) => {
    if (mappingVariants[idx]) mappingVariants[idx].krozendaVariantId = v._id;
  });

  const mapping = await ProductFulfillmentMapping.create({
    product: product._id,
    provider: 'CJ',
    cjProductId,
    cjProductName: detail.productNameEn || detail.productName || '',
    cjCategoryId: detail.categoryId || '',
    warehouseCountryCode: detail.sourceCountryCode || detail.countryCode || '',
    currency: detail.currency || 'USD',
    sourceStatus: typeof detail.status === 'number' ? detail.status : null,
    variants: mappingVariants,
    pricingMode,
    marginRule: pricingMode === 'AUTOMATIC'
      ? (marginRule && typeof marginRule.value === 'number' ? marginRule : { type: 'PERCENT', value: defaultMarkupPercent })
      : null,
    syncStatus: 'IDLE',
    lastSyncedAt: new Date(),
    onboardedBy,
  });

  onLog?.({ event: 'CJ_PRODUCT_ONBOARDED', cjProductId, productId: String(product._id) });

  return { product, mapping };
}

// `categoryId` filters to CJ products onboarded into that Krozenda category —
// the mapping table has no category of its own (only CJ's raw
// `cjCategoryId`), so the filter has to run on Product first and then narrow
// the mapping query to that set of product ids.
//
// Filtered on Product.category directly (not fulfillmentProvider) — every row
// here is already scoped to `provider: 'CJ'` mappings, so re-checking the
// denormalized flag would just make this depend on it being backfilled for
// product's onboarded before that field existed.
async function listOnboardedProducts({ pageNum = 1, pageSize = 20, categoryId = null } = {}) {
  const skip = (pageNum - 1) * pageSize;
  const filter = { provider: 'CJ' };

  if (categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) {
      return { list: [], pageNum, pageSize, total: 0 };
    }
    const productIds = await Product.find({ category: categoryId }).distinct('_id');
    filter.product = { $in: productIds };
  }

  const [rows, total] = await Promise.all([
    ProductFulfillmentMapping.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate({
        path: 'product',
        select: 'name price stock images isActive variants category',
        populate: { path: 'category', select: 'name' },
      }),
    ProductFulfillmentMapping.countDocuments(filter),
  ]);
  return { list: rows, pageNum, pageSize, total };
}

// Krozenda categories that currently hold at least one onboarded CJ product,
// with a count each — backs the admin "Category" screen's cards and the
// "Products" screen's category filter.
//
// Driven off ProductFulfillmentMapping (provider: 'CJ' is the real,
// always-correct signal for "this product is CJ-fulfilled") rather than
// Product.fulfillmentProvider — that field is only a browse-time
// denormalization set at onboarding, and reading it here would silently
// under-count every product onboarded before that field existed.
async function getOnboardedCategorySummary() {
  const rows = await ProductFulfillmentMapping.aggregate([
    { $match: { provider: 'CJ' } },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'product',
        pipeline: [{ $project: { category: 1 } }],
      },
    },
    { $unwind: '$product' },
    { $group: { _id: '$product.category', count: { $sum: 1 } } },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
        pipeline: [{ $project: { name: 1, image: 1 } }],
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((row) => ({
    categoryId: row._id ? row._id.toString() : null,
    name: row.category?.name || 'Uncategorised',
    image: row.category?.image || null,
    productCount: row.count,
  }));
}

/**
 * Bulk Adjust Pricing for Onboarded CJ Products
 * @param {Object} params
 * @param {Array<string>} params.productIds - Array of Product Mongo IDs to adjust (or empty if all=true)
 * @param {boolean} params.all - If true, applies to all onboarded CJ products
 * @param {number} params.percentage - Percentage value (e.g., 30 for 30%)
 * @param {string} params.method - 'INCREASE_PERCENT' | 'DECREASE_PERCENT' | 'FIXED'
 * @param {string} params.applyOn - 'CJ_COST' | 'CURRENT_PRICE'
 * @param {string} params.rounding - 'ROUND' | '9_ENDING' | 'NONE'
 */
async function bulkAdjustPricing({
  productIds = [],
  all = false,
  percentage = 30,
  method = 'INCREASE_PERCENT',
  applyOn = 'CJ_COST',
  rounding = 'ROUND',
  updatedBy = null,
} = {}) {
  const filter = { provider: 'CJ' };
  if (!all && Array.isArray(productIds) && productIds.length > 0) {
    filter.product = { $in: productIds };
  }

  const mappings = await ProductFulfillmentMapping.find(filter).populate('product');
  if (!mappings || mappings.length === 0) {
    return { success: true, updatedCount: 0, products: [] };
  }

  const updatedProducts = [];
  const pct = Math.max(0, Number(percentage) || 0);

  for (const mapping of mappings) {
    const product = mapping.product;
    if (!product) continue;

    let hasProductChanges = false;
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

    if (hasVariants) {
      const mappingVariantMap = new Map();
      (mapping.variants || []).forEach((mv) => {
        if (mv.krozendaVariantId) {
          mappingVariantMap.set(String(mv.krozendaVariantId), mv);
        }
        if (mv.cjVariantId) {
          mappingVariantMap.set(String(mv.cjVariantId), mv);
        }
      });

      for (const variant of product.variants) {
        const mv = mappingVariantMap.get(String(variant._id));
        let newPrice;

        if (applyOn === 'CJ_COST' && mv && typeof mv.providerCost === 'number') {
          const costInr = usdToInr(mv.providerCost) + usdToInr(mv.providerShippingCost || 0);
          if (method === 'FIXED') {
            newPrice = applyPriceRounding(costInr + pct, rounding);
          } else if (method === 'DECREASE_PERCENT') {
            newPrice = applyPriceRounding(Math.max(1, costInr - (costInr * (pct / 100))), rounding);
          } else {
            // INCREASE_PERCENT
            newPrice = calculateMarkupPrice({ costInInr: costInr, markupPercent: pct, rounding });
          }
        } else {
          // CURRENT_PRICE fallback
          const current = variant.price || product.price || 0;
          if (method === 'FIXED') {
            newPrice = applyPriceRounding(current + pct, rounding);
          } else if (method === 'DECREASE_PERCENT') {
            newPrice = applyPriceRounding(Math.max(1, current - (current * (pct / 100))), rounding);
          } else {
            newPrice = applyPriceRounding(current + (current * (pct / 100)), rounding);
          }
        }

        if (newPrice && newPrice !== variant.price) {
          variant.price = newPrice;
          hasProductChanges = true;
        }
      }

      // Base product price is min of variants
      const variantPrices = product.variants.map((v) => v.price).filter((p) => typeof p === 'number' && p > 0);
      if (variantPrices.length > 0) {
        product.price = Math.min(...variantPrices);
        hasProductChanges = true;
      }
    } else {
      // Simple product
      let newPrice;
      if (applyOn === 'CJ_COST') {
        const costInr = usdToInr(mapping.variants?.[0]?.providerCost || 0) +
          usdToInr(mapping.variants?.[0]?.providerShippingCost || 0);
        if (costInr > 0) {
          if (method === 'FIXED') {
            newPrice = applyPriceRounding(costInr + pct, rounding);
          } else if (method === 'DECREASE_PERCENT') {
            newPrice = applyPriceRounding(Math.max(1, costInr - (costInr * (pct / 100))), rounding);
          } else {
            newPrice = calculateMarkupPrice({ costInInr: costInr, markupPercent: pct, rounding });
          }
        }
      }

      if (!newPrice) {
        const current = product.price || 0;
        if (method === 'FIXED') {
          newPrice = applyPriceRounding(current + pct, rounding);
        } else if (method === 'DECREASE_PERCENT') {
          newPrice = applyPriceRounding(Math.max(1, current - (current * (pct / 100))), rounding);
        } else {
          newPrice = applyPriceRounding(current + (current * (pct / 100)), rounding);
        }
      }

      if (newPrice && newPrice !== product.price) {
        product.price = newPrice;
        hasProductChanges = true;
      }
    }

    if (hasProductChanges) {
      await product.save();
      mapping.pricingMode = applyOn === 'CJ_COST' && method === 'INCREASE_PERCENT' ? 'AUTOMATIC' : 'MANUAL';
      mapping.marginRule = { type: method === 'FIXED' ? 'FLAT' : 'PERCENT', value: pct };
      await mapping.save();

      updatedProducts.push({
        _id: product._id,
        name: product.name,
        price: product.price,
      });
    }
  }

  return {
    success: true,
    updatedCount: updatedProducts.length,
    products: updatedProducts,
  };
}

async function bulkOnboardProducts({
  cjProductIds,
  krozendaCategoryId,
  markupType = 'PERCENT',
  markupValue,
  markupPercent,
  priceRounding,
  onboardedBy = null,
}) {
  if (!Array.isArray(cjProductIds) || cjProductIds.length === 0) {
    throw new OnboardingError('cjProductIds must be a non-empty array');
  }
  if (!krozendaCategoryId) {
    throw new OnboardingError('krozendaCategoryId is required for bulk onboarding');
  }

  const category = await Category.findById(krozendaCategoryId);
  if (!category) {
    throw new OnboardingError('krozendaCategoryId does not match an existing category');
  }

  const globalSettings = await CjSettings.getSettings();
  const effectiveType = markupType === 'FLAT' ? 'FLAT' : 'PERCENT';
  const effectiveValue = markupValue != null && !isNaN(Number(markupValue))
    ? Number(markupValue)
    : (markupPercent != null && !isNaN(Number(markupPercent))
        ? Number(markupPercent)
        : (globalSettings?.defaultMarkupPercent ?? 30));
  const effectiveRounding = priceRounding || globalSettings?.priceRounding || 'ROUND';

  const succeeded = [];
  const failed = [];

  for (const cjProductId of cjProductIds) {
    try {
      const existing = await ProductFulfillmentMapping.findOne({ provider: 'CJ', cjProductId });
      if (existing) {
        failed.push({
          cjProductId,
          reason: 'Already onboarded',
          code: 'ALREADY_ONBOARDED',
        });
        continue;
      }

      const { product } = await onboardProduct({
        cjProductId,
        krozendaCategoryId,
        pricingMode: 'AUTOMATIC',
        marginRule: { type: effectiveType, value: effectiveValue },
        priceRounding: effectiveRounding,
        onboardedBy,
      });

      succeeded.push({
        cjProductId,
        productId: product._id,
        name: product.name,
        price: product.price,
      });
    } catch (err) {
      failed.push({
        cjProductId,
        reason: err.message || 'Failed to onboard product',
        code: err.code || 'UNKNOWN_ERROR',
      });
    }
  }

  return {
    total: cjProductIds.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    succeeded,
    failed,
  };
}

module.exports = {
  onboardProduct,
  bulkOnboardProducts,
  listOnboardedProducts,
  getOnboardedCategorySummary,
  bulkAdjustPricing,
  computeSellingPrice,
  cleanCjDescription,
  OnboardingError,
};
