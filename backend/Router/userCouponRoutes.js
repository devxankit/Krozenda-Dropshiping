const express = require('express');
const { applyCoupon, listUsedCoupons } = require('../Controllers/couponController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/used', listUsedCoupons);
// Without a limit here the whole coupon namespace can be enumerated one
// guess at a time until a working code falls out.
router.post('/apply', applyCoupon);

module.exports = router;
