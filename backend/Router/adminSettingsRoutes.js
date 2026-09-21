const express = require('express');
const { getGeneralSettings, updateGeneralSettings } = require('../Controllers/adminSettingsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/general', getGeneralSettings);
router.put('/general', updateGeneralSettings);

module.exports = router;
