const express = require('express');
const { listCampaigns, sendCampaign } = require('../Controllers/adminCampaignController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.marketing.notifications'));

router.get('/', listCampaigns);
router.post('/', sendCampaign);

module.exports = router;
