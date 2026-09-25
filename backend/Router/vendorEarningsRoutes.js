const express = require('express');
const { getMyEarningsSummary, listMyEarningsEntries, listMyPayouts } = require('../Controllers/vendorEarningsController');
const { getMyRevenue } = require('../Controllers/revenueController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/summary', getMyEarningsSummary);
router.get('/transactions', listMyEarningsEntries);
// The transfers themselves, with their masked bank snapshot and — when one
// fails — the reason, which a seller is entitled to see.
router.get('/payouts', listMyPayouts);
// Sales, commission and earnings for a window, with a trend and top products
// — the same figures admin sees for this seller (services/revenueService).
router.get('/revenue', getMyRevenue);

module.exports = router;
