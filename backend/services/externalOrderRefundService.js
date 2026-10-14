const razorpay = require('../Config/razorpay');
const Order = require('../Models/Order');
const accounting = require('./accountingPosting');
const { createNotification } = require('../Controllers/notificationController');
const { releaseCoupon } = require('../Controllers/couponController');
const { toPaise } = require('../utils/money');
const { alertAdmins } = require('./adminAlertService');

// Cancelling and refunding an order that an OUTSIDE provider fulfils.
//
// Extracted unchanged from the CJ-era dropshipOrderService when CJ was
// removed. Nothing in here was ever CJ-specific — it cancels an order,
// restocks it, refunds the card that paid for it, posts the reversal and gives
// the coupon back — so it outlives any one provider and is what the next one
// is wired into.
//
// Business rule it exists to enforce: refund to THE ORIGINAL PAYMENT, never to
// the wallet. An externally fulfilled order cannot be paid from the wallet, so
// refunding it into the wallet would hand the buyer money they cannot spend on
// the same thing again. services/orderCancellationService.js refunds to the
// wallet and deliberately refuses these orders for that reason.

function log(entry) {
  console.log(JSON.stringify({ scope: 'EXTERNAL_ORDER', at: new Date().toISOString(), ...entry }));
}

function orderLabel(id) {
  return `ORD-${String(id).slice(-8).toUpperCase()}`;
}

// Lazy: orderController requires this file.
function releaseStock(items) {
  return require('../Controllers/orderController').releaseStock(items);
}

/**
 * Give the coupon back, but only once EVERY order bought with it is
 * cancelled. A split checkout redeems a coupon once (against the primary
 * order) while its discount is spread over both orders — cancelling one half
 * does not un-use the coupon.
 */
async function releaseCouponIfWholeCheckoutCancelled(order) {
  if (!order?.couponCode) return null;

  const siblings = order.checkoutGroupId
    ? await Order.find({ checkoutGroupId: order.checkoutGroupId }).select('status').lean()
    : [{ _id: order._id, status: 'CANCELLED' }];
  if (siblings.some((o) => o.status !== 'CANCELLED')) return null;

  for (const sibling of siblings) {
    const released = await releaseCoupon({ orderId: sibling._id || order._id });
    if (released) return released;
  }
  return null;
}

/**
 * Cancel an externally fulfilled order and refund it to the card that paid.
 *
 * The cancel is claimed with a conditional update first, so two callers racing
 * (an admin clicking twice, a provider webhook arriving mid-click) cannot both
 * go on to refund the same payment.
 */
async function refundAndCancel({ orderId, cancelledBy, reason, notify = true }) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: { $ne: 'CANCELLED' } },
    {
      $set: { status: 'CANCELLED', cancelledBy },
      $push: { statusHistory: { status: 'CANCELLED', at: new Date() } },
    },
    { new: false }
  );
  if (!order) {
    return { ok: false, status: 409, message: 'This order is already cancelled' };
  }

  await releaseStock(order.items);

  let refunded = false;
  if (order.paymentStatus === 'PAID' && order.paymentMethod === 'RAZORPAY' && order.razorpayPaymentId) {
    try {
      // A PARTIAL refund of the shared payment when this order was split from
      // a mixed checkout: only this order's own total goes back.
      await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: toPaise(order.total),
        speed: 'optimum',
        notes: { orderId: String(order._id), reason: String(reason || '').slice(0, 250) },
      });
      refunded = true;
      await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED' } });
    } catch (err) {
      // The order is cancelled either way; the money needs a human. Logged
      // with everything needed to issue the refund by hand.
      log({
        event: 'EXTERNAL_ORDER_REFUND_FAILED',
        orderId: String(order._id),
        razorpayPaymentId: order.razorpayPaymentId,
        amountPaise: toPaise(order.total),
        error: err?.error?.description || err.message,
      });
      await alertAdmins({
        event: 'EXTERNAL_ORDER_REFUND_FAILED',
        title: 'Refund failed — action needed',
        message: `Cancelled order ${orderLabel(order._id)} could not be refunded (₹${order.total.toLocaleString('en-IN')}): ${err?.error?.description || err.message}. Retry the refund from the order.`,
        link: `/admin/orders/detail/${order._id}`,
        key: `EXTERNAL_ORDER_REFUND_FAILED:${order._id}`,
        urgent: true,
      });
    }
  }

  if (refunded) {
    try {
      await accounting.postOrderCancellationRefund({
        order: { ...order.toObject(), paymentStatus: 'REFUNDED' },
      });
    } catch (err) {
      console.error('Accounting posting failed (external order refund), will be reconciled on next read:', err.message);
    }
  }

  await releaseCouponIfWholeCheckoutCancelled({ ...order.toObject(), status: 'CANCELLED' });

  if (notify) {
    const label = String(order._id).slice(-8).toUpperCase();
    await createNotification({
      userId: order.user,
      type: 'ORDER',
      title: 'Order Cancelled',
      message: refunded
        ? `Your order #${label} was cancelled (${reason}). ₹${order.total.toLocaleString('en-IN')} is being refunded to your original payment method.`
        : `Your order #${label} was cancelled (${reason}). Our team will process your refund shortly.`,
      actionType: 'ORDER',
      actionRefId: order._id,
    });
  }

  log({ event: 'EXTERNAL_ORDER_CANCELLED', orderId: String(order._id), cancelledBy, refunded });
  return { ok: true, refunded, order };
}

/**
 * Retry a refund that Razorpay refused earlier. The order is already
 * cancelled; only the money is outstanding.
 *
 * The claim is taken by flipping paymentStatus to REFUNDED BEFORE calling
 * Razorpay, and handed back if the call fails — so two admins clicking at once
 * cannot refund the same payment twice.
 */
async function retryRefund({ orderId }) {
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, status: 'CANCELLED', paymentMethod: 'RAZORPAY', paymentStatus: 'PAID' },
    { $set: { paymentStatus: 'REFUNDED' } },
    { new: false }
  );
  if (!claimed) return { ok: false, status: 409, message: 'Nothing to refund on this order' };

  try {
    await razorpay.payments.refund(claimed.razorpayPaymentId, {
      amount: toPaise(claimed.total),
      speed: 'optimum',
      notes: { orderId: String(claimed._id), reason: 'cancellation refund retry' },
    });
  } catch (err) {
    // Hand the claim back so the next attempt can try again.
    await Order.updateOne({ _id: claimed._id, paymentStatus: 'REFUNDED' }, { $set: { paymentStatus: 'PAID' } });
    return { ok: false, status: 502, message: `Razorpay refused the refund: ${err?.error?.description || err.message}` };
  }

  try {
    await accounting.postOrderCancellationRefund({ order: { ...claimed.toObject(), paymentStatus: 'REFUNDED' } });
  } catch (err) {
    console.error(
      'Accounting posting failed (external order refund retry), will be reconciled on next read:',
      err.message
    );
  }
  return { ok: true, order: await Order.findById(claimed._id) };
}

module.exports = { refundAndCancel, retryRefund, releaseCouponIfWholeCheckoutCancelled, orderLabel, log };
