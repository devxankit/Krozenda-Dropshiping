const express = require('express');
const { listPublicCategories } = require('../Controllers/categoryController');

const { catalogRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(catalogRateLimiter);

router.get('/', listPublicCategories);

module.exports = router;
