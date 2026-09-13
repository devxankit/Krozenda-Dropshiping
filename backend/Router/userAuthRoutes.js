const express = require('express');
const { requestOtp, verifyOtp, getMe, updateProfile, uploadProfileImage } = require('../Controllers/userAuthController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.post('/send-otp', requestOtp);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login-otp', verifyOtp);
router.get('/me', protectUser, getMe);
router.put('/profile', protectUser, updateProfile);
router.post(
  '/profile/image',
  protectUser,
  upload.single('image'),
  processImage('users', { width: 500, height: 500, fit: 'cover' }),
  handleUploadError,
  uploadProfileImage
);

module.exports = router;
