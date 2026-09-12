const express = require('express');
const { register, login, me, updateProfile, submitForVerification } = require('../Controllers/vendorAuthController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protectVendor, me);
router.put('/me', protectVendor, updateProfile);
router.post('/submit-for-verification', protectVendor, submitForVerification);

module.exports = router;
