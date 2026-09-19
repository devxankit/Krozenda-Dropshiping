const Product = require('../../Models/Product');
const Category = require('../../Models/Category');
const CjCategoryMapping = require('../../Models/CjCategoryMapping');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const cjProductService = require('./cjProductService');
const cjImageService = require('./cjImageService');
const { usdToInr, parseCjPrice } = require('./cjPricing');

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
function computeSellingPrice({ pricingMode, marginRule, providerCost, providerShippingCost, manualPrice }) {
  if (pricingMode === 'MANUAL') {
    if (typeof manualPrice !== 'number' || manualPrice <= 0) {
      throw new OnboardingError('A positive sellingPrice is required for manual pricing');
    }
    return manualPrice;
  }

  const cost = usdToInr(providerCost);
  const shipping = usdToInr(providerShippingCost);
  const base = cost + shipping;

  if (!marginRule || typeof marginRule.value !== 'number') {
    throw new OnboardingError('marginRule is required for automatic pricing');
  }

  const margin = marginRule.type === 'FLAT' ? marginRule.value : base * (marginRule.value / 100);
  return Math.round((base + margin) * 100) / 100;
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
    onboardedBy = null,
  },
  { onLog } = {}
) {
  if (!cjProductId) throw new OnboardingError('cjProductId is required');

  const existing = await ProductFulfillmentMapping.findOne({ provider: 'CJ', cjProductId });
  if (existing) {
    throw new OnboardingError('This CJ product has already been onboarded', { code: 'ALREADY_ONBOARDED' });
  }

  const [detail, cjVariants] = await Promise.all([
    cjProductService.getProductDetail(cjProductId, { onLog }),
    cjProductService.getProductVariants(cjProductId, { onLog }),
  ]);

  if (!detail) throw new OnboardingError('CJ product not found', { status: 404 });

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

  for (const cv of chosenVariants) {
    const cjVariantId = cv.vid || cv.variantId;
    const providerCost = parseCjPrice(cv.variantSellPrice ?? cv.sellPrice);
    // CJ's variant list/detail responses never carry a shipping cost or
    // stock figure (verified against a live account — both come back null).
    // Shipping cost only exists via the freight-quote endpoint, which needs
    // a destination address and so is a checkout-time concern, not an
    // onboarding one — 0 here is correct, not a placeholder bug. Stock DOES
    // exist, but only on the separate per-warehouse stock endpoint.
    const providerShippingCost = Number(cv.logisticPrice ?? 0) || 0;
    const providerStock = await cjProductService.getVariantTotalStock(cjVariantId, { onLog });

    const price = computeSellingPrice({
      pricingMode,
      marginRule,
      providerCost,
      providerShippingCost,
      manualPrice: manualPriceByVariant.get(cjVariantId) ?? (hasVariants ? undefined : sellingPrice),
    });

    const variantName =
      cv.variantNameEn || [cv.variantKey, cv.variantValue].filter(Boolean).join(' / ') || cjVariantId;

    // Same import-time optimization as the product gallery above. Content-
    // hash-based dedup in cjImageService means a variant that shares its
    // photo with the main gallery (common — many variants reuse one shot)
    // costs nothing extra here, not a second download.
    const variantImage = cv.variantImage ? await cjImageService.importCjImage(cv.variantImage).catch(() => null) : null;

    productVariants.push({
      name: variantName,
      sku: cv.variantSku || '',
      price,
      stock: providerStock,
      image: variantImage,
      isActive: true,
    });

    mappingVariants.push({
      // filled in after Product.create() assigns subdocument _ids, below
      krozendaVariantId: null,
      cjVariantId,
      cjSku: cv.variantSku || '',
      providerCost,
      providerShippingCost,
      providerStock,
    });
  }

  const basePrice = hasVariants
    ? Math.min(...productVariants.map((v) => v.price))
    : computeSellingPrice({
        pricingMode,
        marginRule,
        providerCost: parseCjPrice(detail.sellPrice),
        providerShippingCost: parseCjPrice(detail.logisticPrice),
        manualPrice: sellingPrice,
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
    marginRule: pricingMode === 'AUTOMATIC' ? marginRule : null,
    syncStatus: 'IDLE',
    lastSyncedAt: new Date(),
    onboardedBy,
  });

  onLog?.({ event: 'CJ_PRODUCT_ONBOARDED', cjProductId, productId: String(product._id) });

  return { product, mapping };
}

async function listOnboardedProducts({ pageNum = 1, pageSize = 20 } = {}) {
  const skip = (pageNum - 1) * pageSize;
  const [rows, total] = await Promise.all([
    ProductFulfillmentMapping.find({ provider: 'CJ' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('product', 'name price stock images isActive'),
    ProductFulfillmentMapping.countDocuments({ provider: 'CJ' }),
  ]);
  return { list: rows, pageNum, pageSize, total };
}

module.exports = { onboardProduct, listOnboardedProducts, computeSellingPrice, cleanCjDescription, OnboardingError };
