const express = require('express');
const { listMyCategories, createMyCategory, listMyBrands, createMyBrand } = require('../Controllers/vendorCatalogController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/categories', listMyCategories);
router.post(
  '/categories',
  upload.single('image'),
  processImage('categories', { width: 600, height: 600, fit: 'cover' }),
  handleUploadError,
  createMyCategory
);

router.get('/brands', listMyBrands);
router.post(
  '/brands',
  upload.single('logo'),
  processImage('brands', { width: 400, height: 400, fit: 'contain' }),
  handleUploadError,
  createMyBrand
);

module.exports = router;
