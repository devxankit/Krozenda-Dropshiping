const express = require('express');
const { getGeneralSettings, updateGeneralSettings } = require('../Controllers/adminSettingsController');
const { getIntegrations, getTaxSettings } = require('../Controllers/adminSystemSettingsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/general', getGeneralSettings);
router.put('/general', updateGeneralSettings);
router.get('/integrations', getIntegrations);
router.get('/taxes', getTaxSettings);

module.exports = router;
