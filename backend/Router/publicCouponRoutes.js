const express = require('express');
const { listPublicCoupons } = require('../Controllers/couponController');

const router = express.Router();

router.get('/', listPublicCoupons);

module.exports = router;
