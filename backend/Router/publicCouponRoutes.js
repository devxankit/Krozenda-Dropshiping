const express = require('express');
const { listPublicCoupons } = require('../Controllers/couponController');

const { catalogRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(catalogRateLimiter);

router.get('/', listPublicCoupons);

module.exports = router;
