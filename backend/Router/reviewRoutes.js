const express = require('express');
const { getReviewableItems, upsertReview, listProductReviews } = require('../Controllers/reviewController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectUser);

const uploadReviewPhotos = [
  upload.array('photos', 4),
  processImages('reviews', { width: 1200, height: 1200, fit: 'inside' }),
  handleUploadError,
];

router.get('/reviewable', getReviewableItems);
router.get('/', listProductReviews);
router.post('/', ...uploadReviewPhotos, upsertReview);

module.exports = router;
