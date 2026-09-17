const express = require('express');
const {
  createRazorpayOrder,
  createOrder,
  listOrders,
  getOrder,
  cancelOrder,
  getOrderTracking,
} = require('../Controllers/orderController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { orderRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(protectUser);

router.get('/', listOrders);
// Both money-moving endpoints are throttled: each one can reserve stock or
// capture a payment, so an unbounded retry loop is expensive in a way a GET
// never is.
router.post('/razorpay-order', orderRateLimiter, createRazorpayOrder);
router.post('/', orderRateLimiter, createOrder);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);
// Reads the stored timeline only; it never calls the carrier, so a buyer
// refreshing this screen cannot spend the seller's carrier rate limit.
router.get('/:id/tracking', getOrderTracking);

module.exports = router;
