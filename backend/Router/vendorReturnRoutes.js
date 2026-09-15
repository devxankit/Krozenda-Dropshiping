const express = require('express');
const { listMyReturns } = require('../Controllers/vendorReturnController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);
router.get('/', listMyReturns);

module.exports = router;
