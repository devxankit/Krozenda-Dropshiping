const express = require('express');
const { getMyEarningsSummary, listMyEarningsEntries } = require('../Controllers/vendorEarningsController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/summary', getMyEarningsSummary);
router.get('/transactions', listMyEarningsEntries);

module.exports = router;
