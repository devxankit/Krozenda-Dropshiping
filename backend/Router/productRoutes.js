const express = require('express');
const {
  listProducts,
  createProduct,
  updateProduct,
  updateProductStatus,
  updateProductFlashSaleStatus,
  updateProductTrendingStatus,
  deleteProduct,
} = require('../Controllers/productController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectAdmin);

const uploadProductImages = [
  upload.array('images', 5),
  processImages('products', { width: 1000, height: 1000, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listProducts);
router.post('/', ...uploadProductImages, createProduct);
router.put('/:id', ...uploadProductImages, updateProduct);
router.patch('/:id/status', updateProductStatus);
router.patch('/:id/flash-sale', updateProductFlashSaleStatus);
router.patch('/:id/trending', updateProductTrendingStatus);
router.delete('/:id', deleteProduct);

module.exports = router;
