const express = require('express');
const { listMyInventory, adjustMyStock } = require('../Controllers/vendorInventoryController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listMyInventory);
router.patch('/:id', adjustMyStock);

module.exports = router;
