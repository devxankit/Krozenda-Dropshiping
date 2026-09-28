const express = require('express');
const {
  getSettings,
  connect,
  disconnect,
  testConnection,
  refreshToken,
  updateMarkupSettings,
  updateVisibilitySettings,
  registerWebhook,
  unregisterWebhook,
} = require('../Controllers/adminCjController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/settings', requirePermission('admin.cj.view'), getSettings);
router.post('/settings/connect', requirePermission('admin.cj.settings'), connect);
router.post('/settings/disconnect', requirePermission('admin.cj.settings'), disconnect);
router.post('/settings/test-connection', requirePermission('admin.cj.settings'), testConnection);
router.post('/settings/refresh-token', requirePermission('admin.cj.settings'), refreshToken);
router.post('/settings/markup', requirePermission('admin.cj.settings'), updateMarkupSettings);
router.post('/settings/visibility', requirePermission('admin.cj.settings'), updateVisibilitySettings);
router.post('/settings/webhook', requirePermission('admin.cj.settings'), registerWebhook);
router.delete('/settings/webhook', requirePermission('admin.cj.settings'), unregisterWebhook);

module.exports = router;
