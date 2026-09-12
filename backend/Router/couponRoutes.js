const express = require('express');
const {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
} = require('../Controllers/couponController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/', listCoupons);
router.get('/:id', getCoupon);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.patch('/:id/status', updateCouponStatus);
router.delete('/:id', deleteCoupon);

module.exports = router;
