const express = require('express');
const { listOrders, getOrder, refreshStatus, cancelOrder } = require('../Controllers/adminCjOrderController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.orders'));

router.get('/', listOrders);
router.get('/:id', getOrder);
router.post('/:id/refresh-status', refreshStatus);
router.post('/:id/cancel', cancelOrder);

module.exports = router;
