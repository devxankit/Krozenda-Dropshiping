const express = require('express');
const { listMyCoupons, createMyCoupon, updateMyCouponStatus, deleteMyCoupon } = require('../Controllers/vendorCouponController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listMyCoupons);
router.post('/', createMyCoupon);
router.patch('/:id/status', updateMyCouponStatus);
router.delete('/:id', deleteMyCoupon);

module.exports = router;
