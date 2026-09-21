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

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protectVendor, me);
router.put('/me', protectVendor, updateProfile);
router.put('/language', protectVendor, updateLanguage);
router.post('/submit-for-verification', protectVendor, submitForVerification);

module.exports = router;
