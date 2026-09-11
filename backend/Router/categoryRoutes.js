const express = require('express');
const {
  getCategoryTree,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
} = require('../Controllers/categoryController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin);

const uploadCategoryImage = [
  upload.single('image'),
  processImage('categories', { width: 600, height: 600, fit: 'cover' }),
  handleUploadError,
];

router.get('/', getCategoryTree);
router.post('/', ...uploadCategoryImage, createCategory);
router.put('/:id', ...uploadCategoryImage, updateCategory);
router.patch('/:id/status', updateCategoryStatus);
router.delete('/:id', deleteCategory);

module.exports = router;
