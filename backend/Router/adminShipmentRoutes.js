const express = require('express');
const {
  createShipment,
  assignAwb,
  schedulePickup,
  listShipments,
  getShipment,
  cancelShipment,
  createReturn,
  getTracking,
  refreshTracking,
} = require('../Controllers/shipmentController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { orderRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(protectAdmin);

// Reuses the existing admin.orders.shipments permission rather than inventing
// a new key — the Shipping module is the same responsibility the Fulfilment
// module already gates on.
router.get('/', requirePermission('admin.orders.shipments'), listShipments);
router.get('/:id', requirePermission('admin.orders.shipments'), getShipment);

// Admin may act on any seller's shipment: scopeFor() returns null for an admin
// caller, so no vendor filter is applied.
router.post('/', requirePermission('admin.orders.shipments'), orderRateLimiter, createShipment);
router.post('/:id/awb', requirePermission('admin.orders.shipments'), orderRateLimiter, assignAwb);
router.post('/:id/pickup', requirePermission('admin.orders.shipments'), orderRateLimiter, schedulePickup);

// Both are real carrier calls that change state, so they share the order
// limiter with create/awb/pickup.
router.post('/:id/cancel', requirePermission('admin.orders.shipments'), orderRateLimiter, cancelShipment);
router.post('/:id/return', requirePermission('admin.orders.shipments'), orderRateLimiter, createReturn);

router.get('/:id/tracking', requirePermission('admin.orders.shipments'), getTracking);
// Separate from the read above: this one spends a carrier call, so it is
// rate limited and never fires on a page load.
router.post('/:id/tracking/refresh', requirePermission('admin.orders.shipments'), orderRateLimiter, refreshTracking);

module.exports = router;
