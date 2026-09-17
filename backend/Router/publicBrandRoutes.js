const express = require('express');
const { listPublicBrands } = require('../Controllers/brandController');

const { catalogRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(catalogRateLimiter);

router.get('/', listPublicBrands);

module.exports = router;
