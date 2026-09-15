const express = require('express');
const {
  requestOtp,
  verifyOtp,
  getMe,
  updateProfile,
  uploadProfileImage,
  changePassword,
  deleteAccount,
} = require('../Controllers/userAuthController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');
const { otpRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.post('/send-otp', otpRateLimiter, requestOtp);
router.post('/request-otp', otpRateLimiter, requestOtp);
router.post('/verify-otp', otpRateLimiter, verifyOtp);
router.post('/login-otp', otpRateLimiter, verifyOtp);
router.get('/me', protectUser, getMe);
router.put('/profile', protectUser, updateProfile);
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
