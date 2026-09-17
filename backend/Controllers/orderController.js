const crypto = require('crypto');
const mongoose = require('mongoose');
const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const Address = require('../Models/Address');
const Cart = require('../Models/Cart');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const Coupon = require('../Models/Coupon');
const WalletTransaction = require('../Models/WalletTransaction');
const { evaluateCoupon, redeemCoupon } = require('./couponController');
const { createNotification } = require('./notificationController');
const { getImageUrl } = require('../utils/imageHelper');
const accounting = require('../services/accountingPosting');
const { readPagination, buildPagination } = require('../utils/pagination');

// Accounting is posted alongside the order, never in front of it. A ledger
// write must never be able to fail a customer's checkout or a cancellation —
// the money has already moved by the time these run — so every call is
// wrapped and only logged on failure. Nothing is lost when one does fail:
// every posting path is idempotent and the Accounting screens re-run the
// reconciler on read, so a missed row is picked up on the next look
// (see services/accountingPosting.reconcileLedger).
async function postAccounting(label, work) {
  try {
    await work();
  } catch (err) {
    console.error(`Accounting posting failed (${label}), will be reconciled on next read:`, err.message);
  }
}

// Client-supplied, so it is length-capped and character-restricted before it
// ever reaches an index — an unbounded string here would let a caller write
// arbitrarily large keys into every order document.
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

function normaliseIdempotencyKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return IDEMPOTENCY_KEY_RE.test(trimmed) ? trimmed : null;
}

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

// checkout errors carry a machine-readable `code` (and sometimes per-item
// details) so the cart/checkout UI can highlight the offending line rather
// than showing one generic toast.
function serializeCheckoutError(error) {
  return {
    success: false,
    ...(error.code ? { code: error.code } : {}),
    message: error.message,
    ...(error.details ? { details: error.details } : {}),
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
  const allEntries = cart?.items || [];
  if (allEntries.length === 0) {
    return { error: { status: 400, message: 'Your cart is empty' } };
  }

  // Entries whose product was hard-deleted OR deactivated since being added.
  // These used to be filtered out silently, which meant a buyer who put three
  // items in their cart could be charged for two without ever being told —
  // the order just came out smaller than the summary they had agreed to.
  // Now checkout stops and names them so the buyer decides.
  const unavailable = allEntries.filter((entry) => !entry.product || !entry.product.isActive);
  if (unavailable.length > 0) {
    const names = unavailable.map((entry) => entry.product?.name).filter(Boolean);
    return {
      error: {
        status: 409,
        code: 'CART_ITEM_UNAVAILABLE',
        message: names.length
          ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available. Please remove ${names.length === 1 ? 'it' : 'them'} from your cart to continue.`
          : 'Some items in your cart are no longer available. Please review your cart to continue.',
        details: { productIds: unavailable.map((entry) => entry.product?._id?.toString()).filter(Boolean) },
      },
    };
  }

  const cartEntries = allEntries;

  // Same reasoning for stock: reserveStock would reject the whole order at the
  // very end anyway, so catching it here gives the buyer a specific message
  // ("Only 2 left") before a payment is taken rather than after.
  const short = cartEntries.filter((entry) => entry.product.stock < entry.quantity);
  if (short.length > 0) {
    const first = short[0];
    return {
      error: {
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message:
          first.product.stock > 0
            ? `Only ${first.product.stock} of "${first.product.name}" ${first.product.stock === 1 ? 'is' : 'are'} left. Please reduce the quantity to continue.`
            : `"${first.product.name}" just went out of stock. Please remove it from your cart to continue.`,
        details: {
          items: short.map((entry) => ({
            productId: entry.product._id.toString(),
            name: entry.product.name,
            requested: entry.quantity,
            available: entry.product.stock,
          })),
        },
      },
    };
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
    return res.status(checkout.error.status).json(serializeCheckoutError(checkout.error));
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

  // Accepted from either the standard header or the body so a WebView client
  // that can't easily set headers still gets the protection.
  const idempotencyKey = normaliseIdempotencyKey(
    req.get('Idempotency-Key') || req.body.idempotencyKey
  );

  // Fast path: the retry arrives after the first call already committed. The
  // unique index below is still the real guarantee (this read can lose a race
  // with a request that hasn't committed yet) — this just avoids doing the
  // whole payment/stock dance again in the common case.
  if (idempotencyKey) {
    const existing = await Order.findOne({ user: req.user._id, idempotencyKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Order already placed',
        data: serializeOrder(existing),
      });
    }
  }

  const checkout = await computeCheckoutTotals(req.user, { addressId, couponCode, shippingFee });
  if (checkout.error) {
    return res.status(checkout.error.status).json(serializeCheckoutError(checkout.error));
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
    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: total } },
      { $inc: { walletBalance: -total } },
      { new: true }
    );
    if (!updatedCustomer) {
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
      idempotencyKey,
      status: 'PENDING',
    });
  } catch (err) {
    await releaseStock(items);
    if (paymentMethod === 'WALLET') {
      await Customer.updateOne({ _id: req.user._id }, { $inc: { walletBalance: total } });
    }
    if (err.code === 11000) {
      // Lost the race against a concurrent identical submission (a double
      // tap, or the same request retried after a timeout). Everything this
      // call reserved has just been released above, and the winner's order is
      // already committed — hand that one back so the buyer sees one order,
      // not an error.
      if (idempotencyKey) {
        const winner = await Order.findOne({ user: req.user._id, idempotencyKey });
        if (winner) {
          return res.status(200).json({
            success: true,
            message: 'Order already placed',
            data: serializeOrder(winner),
          });
        }
      }
      // A razorpayPaymentId collision with no matching idempotency key is
      // NOT treated as a retry: the same captured payment being presented
      // again under a different checkout attempt is exactly the replay this
      // index exists to stop, so it stays a hard 409.
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_ORDER',
        message: 'This payment has already been used for another order',
      });
    }
    throw err;
  }

  if (paymentMethod === 'WALLET') {
    const freshCustomer = await Customer.findById(req.user._id);
    await WalletTransaction.create({
      user: req.user._id,
      type: 'DEBIT',
      amount: total,
      balanceAfter: freshCustomer.walletBalance,
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

  // A prepaid order's money is in hand right now, so its sale, commission and
  // gateway fee post immediately. A COD order posts nothing yet — the cash is
  // still with the courier until an admin records the remittance (task §12).
  await postAccounting('order sale', () => accounting.postOrderSale(order.toObject()));

  res.status(201).json({ success: true, message: 'Order placed successfully', data: serializeOrder(order) });
}

// A list row only needs enough to render the card — who it was, what it cost,
// where it is, and a thumbnail strip. Sending the full serializeOrder payload
// (every line item's snapshot, the whole shipping address, the complete status
// history) for every order the buyer has ever placed made this endpoint grow
// without bound; OrderDetailsScreen fetches the full document by id anyway.
function serializeOrderSummary(o) {
  return {
    id: o._id.toString(),
    itemCount: o.items.length,
    // First three thumbnails is what the card shows; the rest is dead weight.
    previewItems: o.items.slice(0, 3).map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      image: item.image,
      quantity: item.quantity,
    })),
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    deliveredAt: o.deliveredAt,
    createdAt: o.createdAt,
  };
}

async function listOrders(req, res) {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status && Order.STATUSES.includes(status)) {
    filter.status = status;
  }

  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items: orders.map(serializeOrderSummary) },
    pagination: buildPagination({ page, limit, total }),
  });
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
    const refundedCustomer = await Customer.findOneAndUpdate(
      { _id: req.user._id },
      { $inc: { walletBalance: order.total } },
      { new: true }
    );
    await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: order.total,
      balanceAfter: refundedCustomer.walletBalance,
      source: 'ORDER_REFUND',
      orderId: order._id,
      status: 'SUCCESS',
    });
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });

    // Reverse whatever was posted for this order. The original SALE rows stay
    // exactly as they were — this writes REFUND debits against them and hands
    // the commission back (task §15 Rules 1 and 3).
    await postAccounting('cancellation refund', () =>
      accounting.postOrderCancellationRefund({ order: { ...order.toObject(), paymentStatus: 'REFUNDED' } })
    );
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
  serializeOrderSummary,
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
