const express = require('express');
const { listKycQueue, getKycApplication } = require('../Controllers/adminKycController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.kyc.review'));

router.get('/', listKycQueue);
router.get('/:vendorId', getKycApplication);

module.exports = router;
