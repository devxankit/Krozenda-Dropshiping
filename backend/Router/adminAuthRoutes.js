const express = require('express');
const {
  login,
  me,
  updateLanguage,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} = require('../Controllers/adminAuthController');
const { protectAdmin } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

const uploadAvatar = [upload.single('image'), processImage('avatars'), handleUploadError];

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protectAdmin, me);
router.put('/language', protectAdmin, updateLanguage);
router.put('/profile', protectAdmin, ...uploadAvatar, updateProfile);
router.put('/change-password', protectAdmin, changePassword);

module.exports = router;
