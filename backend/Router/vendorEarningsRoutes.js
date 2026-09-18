const express = require('express');
const { getMyEarningsSummary, listMyEarningsEntries, listMyPayouts } = require('../Controllers/vendorEarningsController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/summary', getMyEarningsSummary);
router.get('/transactions', listMyEarningsEntries);
// The transfers themselves, with their masked bank snapshot and — when one
// fails — the reason, which a seller is entitled to see.
router.get('/payouts', listMyPayouts);

module.exports = router;
