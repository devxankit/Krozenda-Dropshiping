const express = require('express');
const { getGeneralSettings, updateGeneralSettings } = require('../Controllers/adminSettingsController');
const { getIntegrations, getTaxSettings } = require('../Controllers/adminSystemSettingsController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

// General settings carry the platform commission, GST and buyer platform fee.
const VIEW = requirePermission('admin.settings.view');
const MANAGE = requirePermission('admin.settings.manage');

router.get('/general', VIEW, getGeneralSettings);
router.put('/general', MANAGE, updateGeneralSettings);
router.get('/integrations', VIEW, getIntegrations);
router.get('/taxes', VIEW, getTaxSettings);

module.exports = router;
