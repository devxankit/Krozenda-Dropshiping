const express = require('express');
const { listPublicBanners } = require('../Controllers/bannerController');

const { catalogRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(catalogRateLimiter);

router.get('/', listPublicBanners);

module.exports = router;
