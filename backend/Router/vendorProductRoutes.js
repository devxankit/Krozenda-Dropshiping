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

const multer = require('multer');
const { importProducts, getImportTemplate } = require('../Controllers/vendorProductImportController');

const router = express.Router();

// A separate multer instance: the image pipeline's filter rejects anything
// that is not an image, and this endpoint takes exactly one CSV. 2MB is far
// more than 500 rows of text.
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // Browsers and Excel disagree about the mime type of a .csv, so the
    // extension is what this trusts; the parser is the real validation.
    const looksCsv =
      /\.csv$/i.test(file.originalname || '') ||
      ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'].includes(file.mimetype);
    if (!looksCsv) return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    cb(null, true);
  },
});

router.use(protectVendor);

const uploadProductImages = [
  upload.array('images', 5),
  processImages('products', { width: 1000, height: 1000, fit: 'cover' }),
  handleUploadError,
];

router.get('/', listMyProducts);

// Bulk upload. The template comes first in the file because it is the first
// thing a seller needs, and `dryRun` lets the screen preview the outcome
// before anything is written.
router.get('/import/template', getImportTemplate);
router.post('/import', uploadCsv.single('file'), importProducts);
router.get('/barcode/:code', getMyProductByBarcode);
router.get('/:id/barcode.png', getMyProductBarcodeImage);
router.get('/:id/qrcode.png', getMyProductQrImage);
router.get('/:id', getMyProduct);
router.post('/', ...uploadProductImages, createMyProduct);
router.put('/:id', ...uploadProductImages, updateMyProduct);
router.delete('/:id', deleteMyProduct);

module.exports = router;
