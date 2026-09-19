const express = require('express');
const {
  listShipments,
  getShipment,
  refreshTracking,
  freightQuote,
} = require('../Controllers/adminCjShipmentController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.shipments'));

router.get('/', listShipments);
router.post('/freight-quote', freightQuote);
router.get('/:id', getShipment);
router.post('/:id/refresh-tracking', refreshTracking);

module.exports = router;
