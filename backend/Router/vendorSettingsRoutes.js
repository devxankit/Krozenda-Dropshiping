const express = require('express');
const { getMySettings, updateMySettings } = require('../Controllers/vendorSettingsController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', getMySettings);
router.put('/', updateMySettings);

module.exports = router;
