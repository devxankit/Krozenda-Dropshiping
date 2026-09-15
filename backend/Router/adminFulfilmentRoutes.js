const express = require('express');
const {
  listSubOrders,
  advanceSubOrder,
  cancelSubOrder,
  listShipments,
  updateShipment,
  listRtos,
  restockRto,
  listCancellations,
  resolveCancellationRefund,
} = require('../Controllers/adminFulfilmentController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/sub-orders', requirePermission('admin.orders.sub_orders'), listSubOrders);
router.get('/shipments', requirePermission('admin.orders.shipments'), listShipments);
router.get('/rto', requirePermission('admin.returns.manage'), listRtos);
router.get('/cancellations', requirePermission('admin.returns.manage'), listCancellations);

router.post('/fulfilment/sub-orders/:id/advance', requirePermission('admin.orders.sub_orders'), advanceSubOrder);
router.post('/fulfilment/sub-orders/:id/cancel', requirePermission('admin.orders.sub_orders'), cancelSubOrder);
router.put('/fulfilment/shipments/:id', requirePermission('admin.orders.shipments'), updateShipment);
router.post('/fulfilment/rto/:id/restock', requirePermission('admin.returns.manage'), restockRto);
router.post('/fulfilment/cancellations/:id/refund', requirePermission('admin.returns.manage'), resolveCancellationRefund);

module.exports = router;
