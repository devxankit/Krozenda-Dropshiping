const Order = require('../Models/Order');
const { cancelLine } = require('./orderCancellationService');
const { isDropshipOrder } = require('../utils/dropship');
const { createNotification } = require('../Controllers/notificationController');
const { notifyVendorOrderAutoCancelled } = require('./vendorAlertService');

// An order a seller has not accepted within the window is cancelled for them.
//
// "Accepted" is the line moving PENDING -> PROCESSING (item.acceptedAt), so
// this works per line: in a multi-seller order the lines a seller did accept
// stay, the ones nobody accepted are cancelled. Prepaid money goes back to
// where it came from (the Razorpay payment; wallet-paid orders to the wallet);
// COD has nothing collected yet, so nothing to refund.
//
// Dropship (CJ) orders are skipped: they are fulfilled by Krozenda itself and
// are never "accepted" by a seller.

const ACCEPT_WITHIN_HOURS = Number(process.env.ORDER_ACCEPT_WITHIN_HOURS || 24);
const BATCH_SIZE = Number(process.env.ORDER_AUTO_CANCEL_BATCH_SIZE || 100);
const REASON = `Seller did not accept the order within ${ACCEPT_WITHIN_HOURS} hours`;

async function autoCancelUnacceptedOrders({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - ACCEPT_WITHIN_HOURS * 60 * 60 * 1000);

  const candidates = await Order.find({
    status: { $in: ['PENDING', 'PROCESSING'] },
    createdAt: { $lte: cutoff },
    'items.status': 'PENDING',
    // Only orders that really are placed: COD, or money already received.
    $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'PAID' }],
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE);

  let cancelledOrders = 0;
  let cancelledLines = 0;

  for (const order of candidates) {
    if (await isDropshipOrder(order)) continue;

    let refunded = 0;
    let lines = 0;
    const bySeller = new Map();
    for (let index = 0; index < order.items.length; index += 1) {
      if (order.items[index].status !== 'PENDING') continue;
      // cancelLine claims the line atomically, so a seller accepting at this
      // very moment simply makes this call a no-op for that line.
      const result = await cancelLine({
        orderId: order._id,
        lineIndex: index,
        cancelledBy: 'system',
        reason: REASON,
        refundTo: 'original',
      });
      if (result.ok) {
        lines += 1;
        const sellerId = order.items[index].vendor && String(order.items[index].vendor);
        if (sellerId) bySeller.set(sellerId, (bySeller.get(sellerId) || 0) + 1);
        refunded += result.refunded || 0;
      }
    }

    if (!lines) continue;
    cancelledOrders += 1;
    cancelledLines += lines;

    for (const [vendorId, count] of bySeller) {
      await notifyVendorOrderAutoCancelled({ orderId: order._id, vendorId, count, hours: ACCEPT_WITHIN_HOURS });
    }

    const refundText =
      refunded > 0
        ? ` ₹${refunded.toLocaleString('en-IN')} has been refunded${order.paymentMethod === 'RAZORPAY' ? ' to your original payment method' : ' to your wallet'}.`
        : '';
    try {
      await createNotification({
        userId: order.user,
        type: 'ORDER',
        title: 'Order Cancelled',
        message: `Your order was cancelled because the seller did not accept it in time.${refundText}`,
        actionType: 'ORDER',
        actionRefId: order._id,
      });
    } catch (err) {
      console.error('Auto-cancel notification failed:', err.message);
    }
  }

  return { checked: candidates.length, cancelledOrders, cancelledLines };
}

module.exports = { autoCancelUnacceptedOrders, ACCEPT_WITHIN_HOURS };
