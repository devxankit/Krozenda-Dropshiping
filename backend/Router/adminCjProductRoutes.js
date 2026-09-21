const express = require('express');
const {
  onboardProduct,
  listProducts,
  getCategorySummary,
  bulkPricing,
  bulkOnboard,
} = require('../Controllers/adminCjProductController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.products'));

// Before '/' so it never matches the catch-all list route.
router.get('/category-summary', getCategorySummary);
router.get('/', listProducts);
router.post('/onboard', onboardProduct);
router.post('/bulk-onboard', bulkOnboard);
router.post('/bulk-pricing', bulkPricing);

module.exports = router;
