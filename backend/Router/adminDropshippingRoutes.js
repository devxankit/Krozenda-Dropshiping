const express = require('express');
const {
  getDropshipOverview,
  getDropshipPartners,
  getForwardedOrders,
  getDropshipMarginRules,
} = require('../Controllers/adminDropshippingController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

// Dropshipping partner module (Admin > Dropshipping) — see
// adminDropshippingController.js for what "partner" really maps to. Products
// (GET /products) is deliberately NOT routed here: there is no real backing
// for cost price / margin / supplier stock / sync status, so that screen
// stays on its frontend fixture.
const router = express.Router();

router.use(protectAdmin);

router.get('/overview', requirePermission('admin.dropship.overview'), getDropshipOverview);
router.get('/partners', requirePermission('admin.dropship.partners'), getDropshipPartners);
router.get('/orders', requirePermission('admin.dropship.orders'), getForwardedOrders);
router.get('/margins', requirePermission('admin.dropship.margins'), getDropshipMarginRules);

module.exports = router;
