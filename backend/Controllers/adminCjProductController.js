const cjOnboardingService = require('../services/cj/cjOnboardingService');
const cjAuthService = require('../services/cj/cjAuthService');
const { getImageUrl } = require('../utils/imageHelper');

function handleError(res, err) {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  res.status(502).json({
    success: false,
    message: cjAuthService.safeFailureMessage(err.code) || 'Unable to onboard this CJ product.',
  });
}

// POST /admin/cj/products/onboard
async function onboardProduct(req, res) {
  const {
    cjProductId,
    krozendaCategoryId,
    brand,
    pricingMode,
    marginRule,
    sellingPrice,
    variantSelections,
    description,
  } = req.body || {};

  try {
    const { product, mapping } = await cjOnboardingService.onboardProduct({
      cjProductId,
      krozendaCategoryId,
      brand: brand || null,
      pricingMode: pricingMode || 'MANUAL',
      marginRule: marginRule || null,
      sellingPrice: sellingPrice != null ? Number(sellingPrice) : undefined,
      variantSelections: Array.isArray(variantSelections) ? variantSelections : null,
      description,
      onboardedBy: req.admin?._id || null,
    });

    res.status(201).json({
      success: true,
      message: 'CJ product onboarded',
      data: { productId: product._id, mappingId: mapping._id },
    });
  } catch (err) {
    handleError(res, err);
  }
}

// GET /admin/cj/products?pageNum=&pageSize=&categoryId=
async function listProducts(req, res) {
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
  const categoryId = req.query.categoryId || null;

  const result = await cjOnboardingService.listOnboardedProducts({ pageNum, pageSize, categoryId });

  // Product.images is stored as relative paths (see Models/Product.js) —
  // every other admin/public product listing resolves them to servable URLs
  // in its controller (see serializeProduct/serializeProductCard in
  // productController.js) before the response leaves the API; this listing
  // was the one place still shipping the raw path, which is why the CJ
  // Products cards had no image.
  const list = result.list.map((row) => {
    const plain = row.toObject ? row.toObject() : row;
    if (plain.product?.images?.length) {
      plain.product = {
        ...plain.product,
        images: plain.product.images.map((img) => getImageUrl(img)),
      };
    }
    return plain;
  });

  res.json({ success: true, data: { ...result, list } });
}

// GET /admin/cj/products/category-summary
// Krozenda categories that hold at least one onboarded CJ product, with a
// count each. Backs both the standalone Category screen's cards and the
// Products screen's category filter dropdown.
async function getCategorySummary(req, res) {
  const categories = await cjOnboardingService.getOnboardedCategorySummary();
  res.json({ success: true, data: { categories } });
}

// POST /admin/cj/products/bulk-pricing
// body: { productIds?, all?, percentage, method?, applyOn?, rounding? }
async function bulkPricing(req, res) {
  const { productIds, all, percentage, method, applyOn, rounding } = req.body || {};

  try {
    const result = await cjOnboardingService.bulkAdjustPricing({
      productIds,
      all: Boolean(all),
      percentage: Number(percentage) || 30,
      method: method || 'INCREASE_PERCENT',
      applyOn: applyOn || 'CJ_COST',
      rounding: rounding || 'ROUND',
      updatedBy: req.admin?._id || null,
    });

    res.json({
      success: true,
      message: `Successfully adjusted pricing for ${result.updatedCount} product(s).`,
      data: result,
    });
  } catch (err) {
    handleError(res, err);
  }
}

// POST /admin/cj/products/bulk-onboard
// body: { cjProductIds, krozendaCategoryId, markupType?, markupValue?, markupPercent?, priceRounding? }
async function bulkOnboard(req, res) {
  const { cjProductIds, krozendaCategoryId, markupType, markupValue, markupPercent, priceRounding } = req.body || {};

  try {
    const result = await cjOnboardingService.bulkOnboardProducts({
      cjProductIds,
      krozendaCategoryId,
      markupType: markupType || 'PERCENT',
      markupValue: markupValue != null ? Number(markupValue) : (markupPercent != null ? Number(markupPercent) : undefined),
      priceRounding,
      onboardedBy: req.admin?._id || null,
    });

    res.status(200).json({
      success: true,
      message: `Bulk onboarding complete: ${result.succeededCount} succeeded, ${result.failedCount} skipped/failed.`,
      data: result,
    });
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = { onboardProduct, listProducts, getCategorySummary, bulkPricing, bulkOnboard };

