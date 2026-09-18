const express = require('express');
const { login, me, updateLanguage } = require('../Controllers/adminAuthController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', protectAdmin, me);
router.put('/language', protectAdmin, updateLanguage);

module.exports = router;
