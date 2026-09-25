const express = require('express');
const multer = require('multer');
const controller = require('../Controllers/productImportController');

// CSV product import routes. Built by a factory because the admin panel and
// the seller panel expose the same flow; each caller supplies its own auth
// and a `scopeFrom(req)` that says whose batches these are.

// One CSV, in memory. 2MB is far more than 500 rows of text.
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // Browsers and Excel disagree about a .csv's mime type, so the extension
    // is trusted here; the parser is the real validation.
    const looksCsv =
      /\.csv$/i.test(file.originalname || '') ||
      ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'].includes(file.mimetype);
    if (!looksCsv) return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    cb(null, true);
  },
});

function handleCsvUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The CSV must be smaller than 2MB'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Upload a .csv file (in Excel: Save As → CSV)'
          : err.message;
    return res.status(400).json({ success: false, message });
  }
  next(err);
}

function createProductImportRouter({ scopeFrom }) {
  const router = express.Router();

  router.use((req, res, next) => {
    req.importScope = scopeFrom(req);
    next();
  });

  router.get('/template', controller.getTemplate);
  router.get('/', controller.listImports);
  router.post('/', uploadCsv.single('file'), handleCsvUploadError, controller.uploadImport);
  router.post('/approve-products', controller.approvePreviewProducts);
  router.get('/:id', controller.getImport);
  router.get('/:id/rows', controller.listImportRows);
  router.patch('/:id/rows', controller.updateImportRows);
  router.post('/:id/approve', controller.approveImport);
  router.post('/:id/reject', controller.rejectImport);

  return router;
}

module.exports = { createProductImportRouter };
