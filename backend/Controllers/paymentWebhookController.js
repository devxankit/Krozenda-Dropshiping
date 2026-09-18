const crypto = require('crypto');
const Order = require('../Models/Order');
const { safeEqual } = require('../utils/secretBox');

// POST /webhook/payments — Razorpay's server-to-server event feed, the
// reconciliation path that the buyer-driven flow in orderController
// (createRazorpayOrder -> Razorpay Checkout -> POST /user/orders) has no
// equivalent for: if the browser tab dies after Razorpay captures the money
// but before POST /user/orders runs, no Order is ever created and nothing
// else in this codebase would ever notice. This endpoint is that notice.
//
// Unlike the Shiprocket webhook, Razorpay DOES sign its payloads — real
// HMAC-SHA256 over the raw request body, so this is a genuine signature
// check, not a shared-secret header compare.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'PAYMENTS', at: new Date().toISOString(), ...entry }));
}

function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(signature, expected);
}

async function handleRazorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Fail closed, same rule as the Shiprocket webhook: an unconfigured secret
  // must never mean "accept everything".
  if (!secret) {
    log({ event: 'RAZORPAY_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('x-razorpay-signature') || '';
  if (!verifySignature(req.rawBody, signature, secret)) {
    log({ event: 'RAZORPAY_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const eventType = req.body?.event || '';
  const paymentEntity = req.body?.payload?.payment?.entity || null;
  const refundEntity = req.body?.payload?.refund?.entity || null;

  log({ event: 'RAZORPAY_WEBHOOK_RECEIVED', type: eventType });

  try {
    if (eventType === 'payment.captured' && paymentEntity) {
      const order = await Order.findOne({ razorpayPaymentId: paymentEntity.id });
      if (!order) {
        // The capture happened but no order was ever placed against it — the
        // client-driven verify call (POST /user/orders) never ran. This is
        // real captured money with no order to show for it; it needs a human,
        // not an automatic action, since we no longer have the buyer's cart.
        log({
          event: 'RAZORPAY_WEBHOOK_UNRECONCILED_PAYMENT',
          razorpayPaymentId: paymentEntity.id,
          razorpayOrderId: paymentEntity.order_id || null,
          amount: paymentEntity.amount,
          reason: 'Captured payment has no matching order — needs manual reconciliation or refund',
        });
      } else if (order.paymentStatus === 'PENDING') {
        order.paymentStatus = 'PAID';
        await order.save();
        log({ event: 'RAZORPAY_WEBHOOK_ORDER_RECONCILED', orderId: String(order._id) });
      }
    } else if (eventType === 'payment.failed' && paymentEntity) {
      log({
        event: 'RAZORPAY_WEBHOOK_PAYMENT_FAILED',
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id || null,
      });
    } else if (eventType === 'refund.processed' && refundEntity) {
      const order = await Order.findOne({ razorpayPaymentId: refundEntity.payment_id });
      if (order && order.paymentStatus !== 'REFUNDED') {
        order.paymentStatus = 'REFUNDED';
        await order.save();
        log({ event: 'RAZORPAY_WEBHOOK_REFUND_RECONCILED', orderId: String(order._id) });
      }
    } else {
      log({ event: 'RAZORPAY_WEBHOOK_IGNORED', type: eventType });
    }

    return res.status(200).json({ success: true, message: 'Processed' });
  } catch (err) {
    // 500 so Razorpay retries — unlike an unrecognised event, a DB error here
    // may well succeed on the next attempt.
    log({ event: 'RAZORPAY_WEBHOOK_ERROR', type: eventType, message: err.message });
    return res.status(500).json({ success: false, message: 'Processing failed' });
  }
}

module.exports = { handleRazorpayWebhook };
