const express = require('express');
const {
  listBanners,
  createBanner,
  updateBanner,
  updateBannerStatus,
  deleteBanner,
} = require('../Controllers/bannerController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.marketing.banners'));

const uploadBannerImage = [
  upload.single('image'),
  // 'inside', not 'cover': banner artwork carries its own text and prices
  // right up to the edges, and a 1600x600 cover-crop was slicing those off
  // any banner that wasn't already exactly 8:3. Now it is only scaled down.
  processImage('banners', { width: 1920, height: 1080, fit: 'inside' }),
  handleUploadError,
];

router.get('/', listBanners);
router.post('/', ...uploadBannerImage, createBanner);
router.put('/:id', ...uploadBannerImage, updateBanner);
router.patch('/:id/status', updateBannerStatus);
router.delete('/:id', deleteBanner);

module.exports = router;
