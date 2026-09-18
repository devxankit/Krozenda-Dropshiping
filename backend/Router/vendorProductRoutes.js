const express = require('express');
const {
  listMyProducts,
  getMyProduct,
  getMyProductByBarcode,
  getMyProductBarcodeImage,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct,
} = require('../Controllers/vendorProductController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectVendor);

const uploadProductImages = [
  upload.array('images', 5),
  processImages('products', { width: 1000, height: 1000, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listMyProducts);
router.get('/barcode/:code', getMyProductByBarcode);
router.get('/:id/barcode.png', getMyProductBarcodeImage);
router.get('/:id', getMyProduct);
router.post('/', ...uploadProductImages, createMyProduct);
router.put('/:id', ...uploadProductImages, updateMyProduct);
router.delete('/:id', deleteMyProduct);

module.exports = router;
