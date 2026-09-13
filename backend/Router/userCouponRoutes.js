const express = require('express');
const { applyCoupon, listUsedCoupons } = require('../Controllers/couponController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/used', listUsedCoupons);
router.post('/apply', applyCoupon);

module.exports = router;
