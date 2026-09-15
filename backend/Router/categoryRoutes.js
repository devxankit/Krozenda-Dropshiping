const express = require('express');
const {
  listCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  updateCategoryTopStatus,
  decideCategoryApproval,
  deleteCategory,
} = require('../Controllers/categoryController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.categories'));

const uploadCategoryImage = [
  upload.single('image'),
  processImage('categories', { width: 600, height: 600, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listCategories);
router.post('/', ...uploadCategoryImage, createCategory);
router.put('/:id', ...uploadCategoryImage, updateCategory);
router.patch('/:id/status', updateCategoryStatus);
router.patch('/:id/top', updateCategoryTopStatus);
router.patch('/:id/approval', decideCategoryApproval);
router.delete('/:id', deleteCategory);

module.exports = router;
