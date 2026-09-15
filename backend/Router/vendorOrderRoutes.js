const express = require('express');
const { listMyOrders, getMyOrder, updateMyOrderItemStatus } = require('../Controllers/vendorOrderController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listMyOrders);
router.get('/:id', getMyOrder);
router.patch('/:id/items/:productId/status', updateMyOrderItemStatus);

module.exports = router;
