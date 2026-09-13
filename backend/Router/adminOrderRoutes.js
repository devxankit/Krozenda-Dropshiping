const express = require('express');
const { listOrders, updateOrderStatus } = require('../Controllers/adminOrderController');
const { protectAdmin, requireRole } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requireRole('admin'));

router.get('/', listOrders);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
