const express = require('express');
const {
  createRazorpayOrder,
  createOrder,
  listOrders,
  getOrder,
  cancelOrder,
  getOrderTracking,
  getShippingQuote,
  getPaymentMethods,
} = require('../Controllers/orderController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { orderRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

router.use(protectUser);

router.get('/', listOrders);
router.get('/payment-methods', getPaymentMethods);
// Both money-moving endpoints are throttled: each one can reserve stock or
// capture a payment, so an unbounded retry loop is expensive in a way a GET
// never is.
// What shipping costs for this cart, before anything is placed. Each call
// can reach the carrier, so it shares the order limiter — a buyer toggling
// between COD and prepaid is a handful of calls, not a flood.
router.post('/shipping-quote', orderRateLimiter, getShippingQuote);
router.post('/razorpay-order', orderRateLimiter, createRazorpayOrder);
router.post('/', orderRateLimiter, createOrder);
router.get('/:id', getOrder);
router.patch('/:id/cancel', cancelOrder);
// Reads the stored timeline only; it never calls the carrier, so a buyer
// refreshing this screen cannot spend the seller's carrier rate limit.
router.get('/:id/tracking', getOrderTracking);

module.exports = router;
