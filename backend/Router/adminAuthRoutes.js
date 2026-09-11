const express = require('express');
const { login, me } = require('../Controllers/adminAuthController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', protectAdmin, me);

module.exports = router;
