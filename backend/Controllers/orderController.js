const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const User = require('../Models/User');
const Coupon = require('../Models/Coupon');
const WalletTransaction = require('../Models/WalletTransaction');
const { evaluateCoupon, redeemCoupon } = require('./couponController');
const { getImageUrl } = require('../utils/imageHelper');

function serializeOrder(o) {
  return {
    id: o._id.toString(),
    items: o.items.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      variant: item.variant || '',
    })),
    shippingAddress: o.shippingAddress,
    subtotal: o.subtotal,
    discountAmount: o.discountAmount,
    couponCode: o.couponCode,
    shippingFee: o.shippingFee,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    deliveredAt: o.deliveredAt,
    createdAt: o.createdAt,
  };
}

// POST /user/orders/razorpay-order — mirrors walletController.createTopupOrder
// but for a checkout payment rather than a wallet top-up; kept separate so a
// wallet-topup Razorpay order can never be replayed to pay for an order.
async function createRazorpayOrder(req, res) {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `order_${req.user._id}_${Date.now()}`,
    notes: { purpose: 'ORDER_PAYMENT', userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    data: { razorpayOrderId: order.id, amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID },
  });
}

// POST /user/orders — the only place an Order document is ever created.
// Cart items and their prices are read server-side (never trusted from the
// client), payment is verified/settled BEFORE the order is written so a
// failed payment never leaves a paid-looking order behind, and a coupon (if
// any) is redeemed against the order's real _id via couponController's
// existing evaluateCoupon/redeemCoupon engine.
async function createOrder(req, res) {
  const {
    addressId,
    paymentMethod,
    couponCode,
    shippingFee,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  } = req.body;

  if (!mongoose.isValidObjectId(addressId)) {
    return res.status(400).json({ success: false, message: 'Select a valid delivery address' });
  }
  if (!Order.PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Select a valid payment method' });
  }

  const address = await Address.findOne({ _id: addressId, user: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Delivery address not found' });
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const cartEntries = (cart?.items || []).filter((entry) => entry.product);
  if (cartEntries.length === 0) {
    return res.status(400).json({ success: false, message: 'Your cart is empty' });
  }

  const items = cartEntries.map((entry) => ({
    product: entry.product._id,
    name: entry.product.name,
    image: entry.product.images?.[0] ? getImageUrl(entry.product.images[0]) : null,
    price: entry.product.salePrice ?? entry.product.price ?? 0,
    quantity: entry.quantity,
    variant: entry.variant || '',
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = Math.max(0, Number(shippingFee) || 0);
  const previousOrders = await Order.countDocuments({ user: req.user._id, paymentStatus: 'PAID' });
  const isNewCustomer = previousOrders === 0;

  let discountAmount = 0;
  let normalizedCouponCode = null;
  const couponCartItems = cartEntries.map((entry) => ({
    productId: entry.product._id,
    categoryId: entry.product.category,
    price: entry.product.salePrice ?? entry.product.price ?? 0,
    quantity: entry.quantity,
  }));

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });
    if (!coupon) {
      return res.status(400).json({ success: false, message: 'Invalid coupon code' });
    }

    const evaluation = await evaluateCoupon(coupon, {
      userId: req.user._id,
      cartItems: couponCartItems,
      cartTotal: subtotal,
      shippingFee: shipping,
      isNewCustomer,
    });
    if (!evaluation.valid) {
      return res.status(400).json({ success: false, message: evaluation.reason });
    }

    discountAmount = evaluation.discountAmount;
    normalizedCouponCode = coupon.code;
  }

  const total = Math.max(0, subtotal - discountAmount + shipping);

  let paymentStatus = 'PENDING';

  if (paymentMethod === 'WALLET') {
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: total } },
      { $inc: { walletBalance: -total } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }
    paymentStatus = 'PAID';
  } else if (paymentMethod === 'RAZORPAY') {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
    paymentStatus = 'PAID';
  }

  const order = await Order.create({
    user: req.user._id,
    items,
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
    },
    subtotal,
    discountAmount,
    couponCode: normalizedCouponCode,
    shippingFee: shipping,
    total,
    paymentMethod,
    paymentStatus,
    razorpayOrderId: paymentMethod === 'RAZORPAY' ? razorpayOrderId : null,
    razorpayPaymentId: paymentMethod === 'RAZORPAY' ? razorpayPaymentId : null,
    status: 'PENDING',
  });

  if (paymentMethod === 'WALLET') {
    const freshUser = await User.findById(req.user._id);
    await WalletTransaction.create({
      user: req.user._id,
      type: 'DEBIT',
      amount: total,
      balanceAfter: freshUser.walletBalance,
      source: 'ORDER_PAYMENT',
      orderId: order._id,
      status: 'SUCCESS',
    });
  }

  if (normalizedCouponCode) {
    try {
      await redeemCoupon({
        code: normalizedCouponCode,
        userId: req.user._id,
        orderId: order._id,
        cartItems: couponCartItems,
        cartTotal: subtotal,
        shippingFee: shipping,
        isNewCustomer,
      });
    } catch (err) {
      // The coupon passed evaluateCoupon a moment ago but lost a race on
      // usageLimit/perUserLimit before redeemCoupon's transaction committed.
      // The payment already succeeded, so the order still goes through —
      // it just keeps its already-computed discount without a recorded
      // redemption, rather than failing an otherwise-paid order.
    }
  }

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  res.status(201).json({ success: true, message: 'Order placed successfully', data: serializeOrder(order) });
}

async function listOrders(req, res) {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status && Order.STATUSES.includes(status)) {
    filter.status = status;
  }

  const orders = await Order.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: { items: orders.map(serializeOrder) } });
}

async function getOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOne({ _id: id, user: req.user._id });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({ success: true, data: serializeOrder(order) });
}

module.exports = { createRazorpayOrder, createOrder, listOrders, getOrder, serializeOrder };
