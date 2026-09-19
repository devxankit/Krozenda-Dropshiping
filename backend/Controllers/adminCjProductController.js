const cjOnboardingService = require('../services/cj/cjOnboardingService');
const cjAuthService = require('../services/cj/cjAuthService');

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

// GET /admin/cj/products?pageNum=&pageSize=
async function listProducts(req, res) {
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);

  const result = await cjOnboardingService.listOnboardedProducts({ pageNum, pageSize });
  res.json({ success: true, data: result });
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

module.exports = { onboardProduct, listProducts, bulkPricing, bulkOnboard };

