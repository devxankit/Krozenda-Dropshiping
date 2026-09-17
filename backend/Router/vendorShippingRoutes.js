const express = require('express');
const {
  getMyIntegration,
  testConnection,
  disconnectIntegration,
  listPickupLocations,
  createPickupLocation,
  registerPickupLocation,
  updatePickupLocation,
  setDefaultPickupLocation,
  deactivatePickupLocation,
  checkServiceability,
  suggestPackageForOrder,
} = require('../Controllers/vendorShippingController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { writeRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

// Every route below is scoped to req.vendor, set from the bearer token. No
// handler reads a vendorId from the request (task §17).
router.use(protectVendor);

// --- Shiprocket account ----------------------------------------------------
router.get('/integration', getMyIntegration);
// Rate limited: each call performs a real login against Shiprocket, so an
// unbounded "Test Connection" button is a way to burn the carrier's rate limit
// (and, with a wrong password, to look like a brute-force attempt).
router.post('/integration/test-connection', writeRateLimiter, testConnection);
router.delete('/integration', disconnectIntegration);

// --- Pickup locations -------------------------------------------------------
router.get('/pickup-locations', listPickupLocations);
router.post('/pickup-locations', createPickupLocation);
// A real carrier call, so it shares the write limiter with test-connection.
router.post('/pickup-locations/:id/register', writeRateLimiter, registerPickupLocation);
router.put('/pickup-locations/:id', updatePickupLocation);
router.patch('/pickup-locations/:id/default', setDefaultPickupLocation);
router.delete('/pickup-locations/:id', deactivatePickupLocation);

// --- Serviceability & packaging ---------------------------------------------
// Rate-limited: each uncached call is a real request against the carrier, and
// Shiprocket rate-limits the account. The service also caches per lane for 5
// minutes, so a seller clicking around a shipment screen does not spend quota.
router.post('/serviceability', writeRateLimiter, checkServiceability);
router.post('/package/suggest', suggestPackageForOrder);

module.exports = router;
