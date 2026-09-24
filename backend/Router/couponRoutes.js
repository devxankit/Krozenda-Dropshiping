const express = require('express');
const {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  updateCouponStatus,
  deleteCoupon,
} = require('../Controllers/couponController');
const {
  searchCustomers,
  getCouponWhatsapp,
  sendCouponWhatsapp,
} = require('../Controllers/adminCouponWhatsappController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/', listCoupons);
// Before '/:id' so "whatsapp" is not read as a coupon id.
router.get('/whatsapp/customers', searchCustomers);
router.get('/:id', getCoupon);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.patch('/:id/status', updateCouponStatus);
router.delete('/:id', deleteCoupon);
router.get('/:id/whatsapp', getCouponWhatsapp);
router.post('/:id/whatsapp', sendCouponWhatsapp);

module.exports = router;
