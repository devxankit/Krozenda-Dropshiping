const express = require('express');
const { getMyAnalytics } = require('../Controllers/vendorAnalyticsController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);
router.get('/summary', getMyAnalytics);

module.exports = router;
