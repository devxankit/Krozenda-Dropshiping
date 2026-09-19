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

module.exports = { onboardProduct, listProducts };
