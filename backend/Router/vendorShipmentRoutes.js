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
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

// Every handler scopes to req.vendor — see shipmentController.scopeFor.
router.use(protectVendor);

router.get('/', listShipments);
router.get('/:id', getShipment);

// The three money/stock-moving operations share the order limiter: each one is
// a real carrier call that can create a parcel or an AWB, so an unbounded
// retry loop is expensive in a way a GET is not.
router.post('/', createShipment);
router.post('/:id/awb', assignAwb);
router.post('/:id/pickup', schedulePickup);

// Both are real carrier calls that change state, so they share the order
// limiter with create/awb/pickup.
router.post('/:id/cancel', cancelShipment);
router.post('/:id/return', createReturn);

// Label / manifest / invoice. A GET because it is a read of a document the
// carrier already holds, and the service caches the URL so repeated presses of
// "print label" do not each spend a carrier call — see generateDocument.
router.get('/:id/documents/:type', getShipmentDocument);

// Non-delivery reports. The read is live (a carrier call), so it is not
// something a page load should fire — the drawer asks for it on demand.
router.get('/:id/ndr', getShipmentNdr);
// Answering costs a carrier call and changes what happens to a real parcel,
// so it shares the order limiter with the other state-changing operations.
router.post('/:id/ndr/action', actOnShipmentNdr);

router.get('/:id/tracking', getTracking);
// Separate from the read above: this one spends a carrier call, so it is
// rate limited and never fires on a page load.
router.post('/:id/tracking/refresh', refreshTracking);

module.exports = router;
