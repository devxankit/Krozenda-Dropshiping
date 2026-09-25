const express = require('express');
const { uploadDocument, listMyDocuments, deleteMyDocument, getMyFssaiStatus } = require('../Controllers/vendorDocumentController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const { uploadDocument: uploadDocumentFile, processDocument, handleDocumentUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectVendor);

const uploadVendorDocument = [
  uploadDocumentFile.single('file'),
  processDocument('vendors'),
  handleDocumentUploadError,
];

router.get('/', listMyDocuments);
router.get('/fssai', getMyFssaiStatus);
router.post('/', ...uploadVendorDocument, uploadDocument);
router.delete('/:id', deleteMyDocument);

module.exports = router;
