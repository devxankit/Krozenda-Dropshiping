const express = require('express');
const { requestOtp, verifyOtp, getMe } = require('../Controllers/userAuthController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.post('/send-otp', requestOtp);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login-otp', verifyOtp);
router.get('/me', protectUser, getMe);

module.exports = router;
