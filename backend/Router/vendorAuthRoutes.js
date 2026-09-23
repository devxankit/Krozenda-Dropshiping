const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  submitForVerification,
  updateLanguage,
} = require('../Controllers/vendorAuthController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');
const {
  uploadDocument: uploadDocumentFile,
  processDocument,
  handleDocumentUploadError,
} = require('../Middlewares/uploadMiddleware');

const router = express.Router();

const uploadRegDoc = [
  uploadDocumentFile.single('file'),
  processDocument('kyc'),
  handleDocumentUploadError,
];

// Unauthenticated upload endpoint for seller registration KYC documents
router.post('/upload-doc', ...uploadRegDoc, (req, res) => {
  if (!req.file?.url) {
    return res.status(400).json({ success: false, message: 'A document file (image or PDF) is required' });
  }
  res.json({
    success: true,
    message: 'Document uploaded successfully',
    data: {
      url: req.file.url,
      filename: req.file.filename,
      originalname: req.file.originalname,
    },
  });
});

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protectVendor, me);
router.put('/me', protectVendor, updateProfile);
router.put('/language', protectVendor, updateLanguage);
router.post('/submit-for-verification', protectVendor, submitForVerification);

module.exports = router;
