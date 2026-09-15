const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const User = require('../Models/User');
const Coupon = require('../Models/Coupon');
const WalletTransaction = require('../Models/WalletTransaction');
const { evaluateCoupon, redeemCoupon } = require('./couponController');
const { createNotification } = require('./notificationController');
const { getImageUrl } = require('../utils/imageHelper');

// The only shipping prices DeliveryOptionsScreen ever offers — anything else
// arriving in the request body is client tampering, not a legitimate choice.
const ALLOWED_SHIPPING_FEES = [0, 99, 199];

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
      vendorId: item.vendor ? item.vendor.toString() : null,
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
    statusHistory: (o.statusHistory || []).map((entry) => ({ status: entry.status, at: entry.at })),
    createdAt: o.createdAt,
  };
}

// Shared by createRazorpayOrder (a price "quote" before payment) and
// createOrder (the real purchase) so the two can never disagree about what
// the cart actually costs — the only source of truth is the live DB state,
// never anything the client sends beyond which address/coupon/shipping
// option it picked.
async function computeCheckoutTotals(user, { addressId, couponCode, shippingFee }) {
  if (!mongoose.isValidObjectId(addressId)) {
    return { error: { status: 400, message: 'Select a valid delivery address' } };
  }

  const address = await Address.findOne({ _id: addressId, user: user._id });
  if (!address) {
    return { error: { status: 404, message: 'Delivery address not found' } };
  }

  const cart = await Cart.findOne({ user: user._id }).populate('items.product');
  // Drop entries whose product was hard-deleted OR deactivated since being
  // added to the cart — never let a delisted product reach checkout.
  const cartEntries = (cart?.items || []).filter((entry) => entry.product && entry.product.isActive);
  if (cartEntries.length === 0) {
    return { error: { status: 400, message: 'Your cart is empty' } };
  }

  const items = cartEntries.map((entry) => ({
    product: entry.product._id,
    name: entry.product.name,
    image: entry.product.images?.[0] ? getImageUrl(entry.product.images[0]) : null,
    price: entry.product.salePrice ?? entry.product.price ?? 0,
    quantity: entry.quantity,
    variant: entry.variant || '',
    vendor: entry.product.vendor || null,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = ALLOWED_SHIPPING_FEES.includes(Number(shippingFee)) ? Number(shippingFee) : 0;
  const previousOrders = await Order.countDocuments({ user: user._id, paymentStatus: 'PAID' });
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
      return { error: { status: 400, message: 'Invalid coupon code' } };
    }

    const evaluation = await evaluateCoupon(coupon, {
      userId: user._id,
      cartItems: couponCartItems,
      cartTotal: subtotal,
      shippingFee: shipping,
      isNewCustomer,
    });
    if (!evaluation.valid) {
      return { error: { status: 400, message: evaluation.reason } };
    }

    discountAmount = evaluation.discountAmount;
    normalizedCouponCode = coupon.code;
  }

  const total = Math.max(0, subtotal - discountAmount + shipping);

  return {
    address,
    items,
    subtotal,
    shipping,
    discountAmount,
    normalizedCouponCode,
    total,
    couponCartItems,
    isNewCustomer,
  };
}

// Atomically decrements stock for every item, all-or-nothing: if any item
// doesn't have enough stock left, everything already decremented in this
// call is put back before returning. This is the only place order stock is
// ever touched, so two concurrent checkouts for the last unit can never
// both succeed.
async function reserveStock(items) {
  const reserved = [];
  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (!updated) {
      await releaseStock(reserved);
      return { ok: false, productName: item.name };
    }
    reserved.push(item);
  }
  return { ok: true };
}

async function releaseStock(items) {
  if (!items || items.length === 0) return;
  await Promise.all(
    items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }))
  );
}

// One notification per distinct vendor represented in the order, not one per
// item — a seller with 3 of their SKUs in the same cart gets a single "New
// order received" ping, not three.
async function notifyVendorsOfNewOrder(items, orderId) {
  const vendorIds = [...new Set(items.filter((item) => item.vendor).map((item) => item.vendor.toString()))];
  await Promise.all(
    vendorIds.map((vendorId) =>
      createNotification({
        vendorId,
        type: 'ORDER',
        title: 'New Order Received',
        message: `You have a new order for ${items.filter((i) => i.vendor?.toString() === vendorId).length} of your product(s).`,
        actionType: 'ORDER',
        actionRefId: orderId,
      })
    )
  );
}

// POST /user/orders/razorpay-order — mirrors walletController.createTopupOrder
// but for a checkout payment rather than a wallet top-up; kept separate so a
// wallet-topup Razorpay order can never be replayed to pay for an order. The
// amount is always the server-computed total for the caller's own cart —
// never a client-supplied figure — so the payment collected by Razorpay can
// later be checked against this same computation in createOrder.
async function createRazorpayOrder(req, res) {
  const { addressId, couponCode, shippingFee } = req.body;

  const checkout = await computeCheckoutTotals(req.user, { addressId, couponCode, shippingFee });
  if (checkout.error) {
    return res.status(checkout.error.status).json({ success: false, message: checkout.error.message });
  }
  if (checkout.total <= 0) {
    return res.status(400).json({ success: false, message: 'Nothing to pay for this order' });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(checkout.total * 100),
    currency: 'INR',
    receipt: `order_${req.user._id}_${Date.now()}`,
    notes: { purpose: 'ORDER_PAYMENT', userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    data: { razorpayOrderId: order.id, amount: checkout.total, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID },
  });
}

// POST /user/orders — the only place an Order document is ever created.
// Cart items and their prices are read server-side (never trusted from the
// client), payment is verified/settled and stock is reserved BEFORE the
// order is written so a failed payment or an out-of-stock item never leaves
// a paid-looking order behind, and a coupon (if any) is redeemed against the
// order's real _id via couponController's existing evaluateCoupon/
// redeemCoupon engine.
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

  if (!Order.PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Select a valid payment method' });
  }

  const checkout = await computeCheckoutTotals(req.user, { addressId, couponCode, shippingFee });
  if (checkout.error) {
    return res.status(checkout.error.status).json({ success: false, message: checkout.error.message });
  }
  const { address, items, subtotal, shipping, discountAmount, normalizedCouponCode, total, couponCartItems, isNewCustomer } = checkout;

  let paymentStatus = 'PENDING';
  let capturedPayment = null;

  if (paymentMethod === 'RAZORPAY') {
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

    // The signature only proves this (orderId, paymentId) pair is genuine —
    // it says nothing about the amount actually captured. Re-fetch the
    // payment from Razorpay and require it to match this cart's
    // server-computed total, so a payment captured for a different
    // (smaller) amount can never be replayed to pay for a bigger cart.
    try {
      capturedPayment = await razorpay.payments.fetch(razorpayPaymentId);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Unable to verify payment with Razorpay' });
    }
    if (
      !capturedPayment ||
      capturedPayment.order_id !== razorpayOrderId ||
      capturedPayment.status !== 'captured' ||
      capturedPayment.amount !== Math.round(total * 100)
    ) {
      return res.status(400).json({ success: false, message: 'Payment amount could not be verified' });
    }
    paymentStatus = 'PAID';
  }

  const reservation = await reserveStock(items);
  if (!reservation.ok) {
    if (paymentMethod === 'RAZORPAY' && capturedPayment) {
      // Real money was already captured by Razorpay before this endpoint
      // ran — refund it automatically since we can't fulfil the order.
      try {
        await razorpay.payments.refund(razorpayPaymentId, { amount: capturedPayment.amount, speed: 'optimum' });
      } catch (refundErr) {
        console.error('Auto-refund after stock-out failed, needs manual reconciliation:', {
          razorpayPaymentId,
          error: refundErr.message,
        });
      }
      return res.status(409).json({
        success: false,
        message: `"${reservation.productName}" just went out of stock. Your payment is being refunded automatically.`,
      });
    }
    return res.status(409).json({ success: false, message: `"${reservation.productName}" just went out of stock.` });
  }

  if (paymentMethod === 'WALLET') {
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: total } },
      { $inc: { walletBalance: -total } },
      { new: true }
    );
    if (!updatedUser) {
      await releaseStock(items);
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }
    paymentStatus = 'PAID';
  }

  let order;
  try {
    order = await Order.create({
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
  } catch (err) {
    await releaseStock(items);
    if (paymentMethod === 'WALLET') {
      await User.updateOne({ _id: req.user._id }, { $inc: { walletBalance: total } });
    }
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This payment has already been used for another order' });
    }
    throw err;
  }

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

  await createNotification({
    userId: req.user._id,
    type: 'ORDER',
    title: 'Order Placed',
    message: `Your order for ${items.length} item(s) worth ₹${total.toLocaleString('en-IN')} has been placed successfully.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  await notifyVendorsOfNewOrder(items, order._id);

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

// PATCH /user/orders/:id/cancel — a user may only cancel their own order,
// and only while it's still in a state that hasn't shipped yet. Restores
// stock and, for a paid order, refunds to the wallet — both exactly once,
// enforced by the atomic status-guarded findOneAndUpdate below rather than
// a read-then-write check (so a double-click / retry can't double-refund).
const USER_CANCELLABLE_STATUSES = ['PENDING', 'PROCESSING'];

async function cancelOrder(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const order = await Order.findOneAndUpdate(
    { _id: id, user: req.user._id, status: { $in: USER_CANCELLABLE_STATUSES } },
    { $set: { status: 'CANCELLED', cancelledBy: 'buyer' }, $push: { statusHistory: { status: 'CANCELLED', at: new Date() } } },
    { new: false }
  );

  if (!order) {
    const exists = await Order.exists({ _id: id, user: req.user._id });
    return res.status(exists ? 400 : 404).json({
      success: false,
      message: exists ? 'This order can no longer be cancelled' : 'Order not found',
    });
  }

  await releaseStock(order.items);

  if (order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD') {
    const refundedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { walletBalance: order.total } },
      { new: true }
    );
    await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: order.total,
      balanceAfter: refundedUser.walletBalance,
      source: 'ORDER_REFUND',
      orderId: order._id,
      status: 'SUCCESS',
    });
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });
  }

  await createNotification({
    userId: req.user._id,
    type: 'ORDER',
    title: 'Order Cancelled',
    message: `Your order worth ₹${order.total.toLocaleString('en-IN')} has been cancelled.`,
    actionType: 'ORDER',
    actionRefId: order._id,
  });

  res.json({ success: true, message: 'Order cancelled successfully' });
}

module.exports = {
  createRazorpayOrder,
  createOrder,
  listOrders,
  getOrder,
  cancelOrder,
  serializeOrder,
  releaseStock,
  reserveStock,
  notifyVendorsOfNewOrder,
};
