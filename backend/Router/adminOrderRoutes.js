const express = require('express');
const { listOrders, getOrder, createOrder, updateOrderStatus, deleteOrder } = require('../Controllers/adminOrderController');
const { protectAdmin, requireRole } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requireRole('admin'));

router.get('/', listOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
// Cancelled, never-paid orders only (test data). Admin role only, like the rest.
router.delete('/:id', deleteOrder);

module.exports = router;
