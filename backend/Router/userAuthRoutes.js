const express = require('express');
const {
  requestOtp,
  verifyOtp,
  refreshAccessToken,
  getMe,
  updateProfile,
  updateLanguage,
  uploadProfileImage,
  changePassword,
  deleteAccount,
} = require('../Controllers/userAuthController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');
const { otpRateLimiter, refreshRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.post('/send-otp', otpRateLimiter, requestOtp);
router.post('/request-otp', otpRateLimiter, requestOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtp);
router.post('/login-otp', otpRateLimiter, verifyOtp);
router.post('/refresh-token', refreshRateLimiter, refreshAccessToken);
router.get('/me', protectUser, getMe);
router.put('/profile', protectUser, updateProfile);
router.put('/language', protectUser, updateLanguage);
router.put('/change-password', protectUser, changePassword);
router.delete('/account', protectUser, deleteAccount);
router.post(
  '/profile/image',
  protectUser,
  upload.single('image'),
  processImage('users', { width: 500, height: 500, fit: 'cover' }),
  handleUploadError,
  uploadProfileImage
);

module.exports = router;
