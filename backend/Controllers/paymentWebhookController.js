const Order = require('../Models/Order');
const CheckoutAttempt = require('../Models/CheckoutAttempt');
const { notifyRefundProcessed } = require('../services/buyerAlertService');
const { verifyRazorpaySignature } = require('../utils/razorpayWebhookVerify');

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

async function handleRazorpayWebhook(req, res) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Fail closed, same rule as the Shiprocket webhook: an unconfigured secret
  // must never mean "accept everything".
  if (!secret) {
    log({ event: 'RAZORPAY_WEBHOOK_REJECTED', reason: 'NO_SECRET_CONFIGURED' });
    return res.status(503).json({ success: false, message: 'Webhook is not configured' });
  }

  const signature = req.get('x-razorpay-signature') || '';
  if (!verifyRazorpaySignature(req.rawBody, signature, secret)) {
    log({ event: 'RAZORPAY_WEBHOOK_REJECTED', reason: 'BAD_SIGNATURE' });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const eventType = req.body?.event || '';
  const paymentEntity = req.body?.payload?.payment?.entity || null;
  const refundEntity = req.body?.payload?.refund?.entity || null;

  log({ event: 'RAZORPAY_WEBHOOK_RECEIVED', type: eventType });

  try {
    if (eventType === 'payment.captured' && paymentEntity) {
      // One payment can pay for two orders (a checkout split into a dropship
      // and a standard order), so every order on it is reconciled.
      const orders = await Order.find({ razorpayPaymentId: paymentEntity.id });
      const order = orders[0] || null;
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
        // Usually the buyer's own POST /user/orders is just a few seconds
        // behind this webhook, so nobody is alerted yet: the engagement job
        // alerts admins only if there is still no order a few minutes later,
        // and never sends this buyer a "payment failed" reminder.
        if (paymentEntity.order_id) {
          await CheckoutAttempt.updateOne(
            { razorpayOrderId: paymentEntity.order_id },
            { $set: { capturedAt: new Date(), razorpayPaymentId: paymentEntity.id } }
          );
        }
      } else {
        for (const pending of orders.filter((o) => o.paymentStatus === 'PENDING')) {
          pending.paymentStatus = 'PAID';
          await pending.save();
          log({ event: 'RAZORPAY_WEBHOOK_ORDER_RECONCILED', orderId: String(pending._id) });
        }
      }
    } else if (eventType === 'payment.failed' && paymentEntity) {
      log({
        event: 'RAZORPAY_WEBHOOK_PAYMENT_FAILED',
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id || null,
      });
      // Feeds the "complete your payment" reminder (Jobs/engagementJob). Only
      // the first failure is kept; a buyer retrying the card fails again.
      if (paymentEntity.order_id) {
        await CheckoutAttempt.updateOne(
          { razorpayOrderId: paymentEntity.order_id, failedAt: null },
          { $set: { failedAt: new Date(), failureReason: String(paymentEntity.error_description || '').slice(0, 200) } }
        );
      }
    } else if (eventType === 'refund.processed' && refundEntity) {
      // Which order the refund is for. Every refund this backend issues names
      // its order in `notes.orderId` — needed because a split checkout's two
      // orders share one payment, and a partial refund of one must not mark
      // the other refunded. Without a note, only an unambiguous single order
      // on the payment is touched.
      const orders = await Order.find({ razorpayPaymentId: refundEntity.payment_id });
      const notedId = refundEntity.notes?.orderId ? String(refundEntity.notes.orderId) : null;
      const order = notedId
        ? orders.find((o) => String(o._id) === notedId) || null
        : orders.length === 1
          ? orders[0]
          : null;
      if (!order && orders.length > 1) {
        log({
          event: 'RAZORPAY_WEBHOOK_REFUND_AMBIGUOUS',
          razorpayPaymentId: refundEntity.payment_id,
          orderIds: orders.map((o) => String(o._id)),
        });
      } else if (order && order.paymentStatus !== 'REFUNDED') {
        order.paymentStatus = 'REFUNDED';
        await order.save();
        log({ event: 'RAZORPAY_WEBHOOK_REFUND_RECONCILED', orderId: String(order._id) });
      }
      // The money has actually left for the buyer's card/UPI — tell them.
      // Keyed on the Razorpay refund id, so a replayed webhook is silent.
      if (order) {
        await notifyRefundProcessed({
          order,
          amount: Number(refundEntity.amount || 0) / 100,
          destination: 'original payment method',
          key: `RAZORPAY:${refundEntity.id}`,
        });
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
