const express = require('express');
const { getMySummary } = require('../Controllers/vendorDashboardController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.get('/summary', protectVendor, getMySummary);

module.exports = router;
