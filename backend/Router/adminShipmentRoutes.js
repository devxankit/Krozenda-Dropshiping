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
  getShipmentDocument,
  getShipmentNdr,
  actOnShipmentNdr,
  refreshTracking,
} = require('../Controllers/shipmentController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

// Reuses the existing admin.orders.shipments permission rather than inventing
// a new key — the Shipping module is the same responsibility the Fulfilment
// module already gates on.
router.get('/', requirePermission('admin.orders.shipments'), listShipments);
router.get('/:id', requirePermission('admin.orders.shipments'), getShipment);

// Admin may act on any seller's shipment: scopeFor() returns null for an admin
// caller, so no vendor filter is applied.
router.post('/', requirePermission('admin.orders.shipments'), createShipment);
router.post('/:id/awb', requirePermission('admin.orders.shipments'), assignAwb);
router.post('/:id/pickup', requirePermission('admin.orders.shipments'), schedulePickup);

// Both are real carrier calls that change state, so they share the order
// limiter with create/awb/pickup.
router.post('/:id/cancel', requirePermission('admin.orders.shipments'), cancelShipment);
router.post('/:id/return', requirePermission('admin.orders.shipments'), createReturn);

// Same document endpoint the seller has, under the admin's own permission —
// support needs to be able to pull a label for any seller's parcel.
router.get('/:id/documents/:type', requirePermission('admin.orders.shipments'), getShipmentDocument);

// Same NDR endpoints as the seller has, under the admin's own permission.
router.get('/:id/ndr', requirePermission('admin.orders.shipments'), getShipmentNdr);
router.post('/:id/ndr/action', requirePermission('admin.orders.shipments'), actOnShipmentNdr);

router.get('/:id/tracking', requirePermission('admin.orders.shipments'), getTracking);
// Separate from the read above: this one spends a carrier call, so it is
// rate limited and never fires on a page load.
router.post('/:id/tracking/refresh', requirePermission('admin.orders.shipments'), refreshTracking);

module.exports = router;
