const express = require('express');
const {
  listMyProducts,
  getMyProduct,
  getMyProductByBarcode,
  getMyProductBarcodeImage,
  getMyProductQrImage,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct,
} = require('../Controllers/vendorProductController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const { createProductImportRouter } = require('./productImportRoutes');

const router = express.Router();

router.use(protectVendor);

const uploadProductImages = [
  upload.array('images', 5),
  processImages('products', { width: 1000, height: 1000, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listMyProducts);

// Bulk CSV import, the same PREVIEW flow as admin: valid rows land in the
// seller's product list straight away as hidden Draft previews, and approving
// one submits it like a hand-added product. Mounted before '/:id' so
// "import" is never read as a product id.
router.use(
  '/import',
  createProductImportRouter({
    scopeFrom: (req) => ({
      ownerType: 'VENDOR',
      mode: 'PREVIEW',
      vendorId: req.vendor._id,
      actorId: req.vendor._id,
      actorName: req.vendor.name || '',
    }),
  })
);
router.get('/barcode/:code', getMyProductByBarcode);
router.get('/:id/barcode.png', getMyProductBarcodeImage);
router.get('/:id/qrcode.png', getMyProductQrImage);
router.get('/:id', getMyProduct);
router.post('/', ...uploadProductImages, createMyProduct);
router.put('/:id', ...uploadProductImages, updateMyProduct);
router.delete('/:id', deleteMyProduct);

module.exports = router;
