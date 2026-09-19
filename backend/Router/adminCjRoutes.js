const express = require('express');
const {
  getSettings,
  connect,
  disconnect,
  testConnection,
  refreshToken,
  updateMarkupSettings,
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

module.exports = router;
