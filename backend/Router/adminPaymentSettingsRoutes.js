const express = require('express');
const { getSettings, updateSettings } = require('../Controllers/adminPaymentSettingsController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/settings', requirePermission('admin.settings.view'), getSettings);
router.put('/settings', requirePermission('admin.settings.manage'), updateSettings);

module.exports = router;
