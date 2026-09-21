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

const router = express.Router();

router.post('/send-otp', requestOtp);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login-otp', verifyOtp);
router.post('/refresh-token', refreshAccessToken);
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
