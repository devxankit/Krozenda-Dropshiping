const express = require('express');
const { listMyReviews, replyToReview } = require('../Controllers/vendorReviewController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listMyReviews);
router.post('/:id/reply', replyToReview);

module.exports = router;
