const express = require('express');
const { listReviews } = require('../Controllers/adminReviewController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.marketing.reviews'));

router.get('/', listReviews);

module.exports = router;
