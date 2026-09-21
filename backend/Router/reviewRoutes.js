const express = require('express');
const { getReviewableItems, upsertReview, listProductReviews } = require('../Controllers/reviewController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

const uploadReviewPhotos = [
  upload.array('photos', 4),
  processImages('reviews', { width: 1200, height: 1200, fit: 'inside' }),
  handleUploadError,
];

// Public — reading a product's reviews needs no account.
router.get('/', listProductReviews);

// Everything else genuinely needs to know who the buyer is.
router.get('/reviewable', protectUser, getReviewableItems);
router.post('/', protectUser, ...uploadReviewPhotos, upsertReview);

module.exports = router;
