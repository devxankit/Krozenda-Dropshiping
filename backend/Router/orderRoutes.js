const express = require('express');
const { createRazorpayOrder, createOrder, listOrders, getOrder } = require('../Controllers/orderController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', listOrders);
router.post('/razorpay-order', createRazorpayOrder);
router.post('/', createOrder);
router.get('/:id', getOrder);

module.exports = router;
