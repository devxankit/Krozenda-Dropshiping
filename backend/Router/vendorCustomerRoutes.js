const express = require('express');
const { listMyCustomers } = require('../Controllers/vendorCustomerController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);
router.get('/', listMyCustomers);

module.exports = router;
