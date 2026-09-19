const express = require('express');
const {
  getCategories,
  searchProducts,
  getProductDetail,
  getVariantStock,
} = require('../Controllers/adminCjCatalogueController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.catalogue'));

router.get('/categories', getCategories);
router.get('/variants/:variantId/stock', getVariantStock);
router.get('/:productId', getProductDetail);
router.get('/', searchProducts);

module.exports = router;
