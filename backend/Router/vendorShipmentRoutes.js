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
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { orderRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

// Every handler scopes to req.vendor — see shipmentController.scopeFor.
router.use(protectVendor);

router.get('/', listShipments);
router.get('/:id', getShipment);

// The three money/stock-moving operations share the order limiter: each one is
// a real carrier call that can create a parcel or an AWB, so an unbounded
// retry loop is expensive in a way a GET is not.
router.post('/', orderRateLimiter, createShipment);
router.post('/:id/awb', orderRateLimiter, assignAwb);
router.post('/:id/pickup', orderRateLimiter, schedulePickup);

// Both are real carrier calls that change state, so they share the order
// limiter with create/awb/pickup.
router.post('/:id/cancel', orderRateLimiter, cancelShipment);
router.post('/:id/return', orderRateLimiter, createReturn);

router.get('/:id/tracking', getTracking);
// Separate from the read above: this one spends a carrier call, so it is
// rate limited and never fires on a page load.
router.post('/:id/tracking/refresh', orderRateLimiter, refreshTracking);

module.exports = router;
