const express = require('express');
const {
  listBanners,
  createBanner,
  updateBanner,
  updateBannerStatus,
  deleteBanner,
} = require('../Controllers/bannerController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin);

const uploadBannerImage = [
  upload.single('image'),
  processImage('banners', { width: 1600, height: 600, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listBanners);
router.post('/', ...uploadBannerImage, createBanner);
router.put('/:id', ...uploadBannerImage, updateBanner);
router.patch('/:id/status', updateBannerStatus);
router.delete('/:id', deleteBanner);

module.exports = router;
