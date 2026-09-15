const express = require('express');
const {
  listBrands,
  createBrand,
  updateBrand,
  updateBrandStatus,
  decideBrandApproval,
  deleteBrand,
} = require('../Controllers/brandController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.manage'));

const uploadBrandLogo = [
  upload.single('logo'),
  processImage('brands', { width: 400, height: 400, fit: 'contain' }),
  handleUploadError,
];

router.get('/', listBrands);
router.post('/', ...uploadBrandLogo, createBrand);
router.put('/:id', ...uploadBrandLogo, updateBrand);
router.patch('/:id/status', updateBrandStatus);
router.patch('/:id/approval', decideBrandApproval);
router.delete('/:id', deleteBrand);

module.exports = router;
