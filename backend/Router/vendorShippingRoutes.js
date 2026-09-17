const express = require('express');
const {
  getMyIntegration,
  testConnection,
  disconnectIntegration,
  listPickupLocations,
  createPickupLocation,
  updatePickupLocation,
  setDefaultPickupLocation,
  deactivatePickupLocation,
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
router.put('/pickup-locations/:id', updatePickupLocation);
router.patch('/pickup-locations/:id/default', setDefaultPickupLocation);
router.delete('/pickup-locations/:id', deactivatePickupLocation);

module.exports = router;
