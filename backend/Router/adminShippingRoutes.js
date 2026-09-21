const express = require('express');
const {
  getSettings,
  updateSettings,
  listIntegrations,
  getOverview,
  testPlatformConnection,
} = require('../Controllers/adminShippingController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

// Reads are gated on settings.view; anything that changes platform policy on
// settings.manage. Same split the rest of the admin panel uses.
router.get('/settings', requirePermission('admin.settings.view'), getSettings);
router.put('/settings', requirePermission('admin.settings.manage'), updateSettings);

router.get('/overview', requirePermission('admin.settings.view'), getOverview);

// Read-only by design: an admin can see that a seller's account is failing,
// but cannot test, edit or re-authenticate it — that would mean handling the
// seller's credentials (task §4, §7).
router.get('/integrations', requirePermission('admin.settings.view'), listIntegrations);

// Performs a real login against Shiprocket with the environment credentials,
// so it is rate limited for the same reason the seller's test button is.
router.post(
  '/platform/test-connection',
  requirePermission('admin.settings.manage'),
  testPlatformConnection
);

module.exports = router;
