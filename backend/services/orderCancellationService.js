const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const WalletTransaction = require('../Models/WalletTransaction');
const accounting = require('./accountingPosting');
const { linePaidPaise } = require('../utils/orderLines');
const { toPaise } = require('../utils/money');
const { isDropshipOrder } = require('../utils/dropship');
const razorpay = require('../Config/razorpay');
const { alertAdmins } = require('./adminAlertService');

// Cancelling money-bearing things on a STANDARD order, and paying the buyer
// back exactly once.
//
// Before this, cancelling a single line (a seller rejecting it, or an admin
// cancelling a sub-order) put the stock back and told the buyer — and kept
// their money. And a whole-order cancellation always refunded the full order
// total, so a line refunded earlier would be paid back a second time.
// `Order.refundedAmount` is what ties the two together.
//
// Refunds go to the wallet, as every other standard-order refund in this
// codebase does. Dropship orders are refunded to the original payment
// instead, by externalOrderRefundService, and are refused here.

const CANCELLABLE_LINE_STATUSES = ['PENDING', 'PROCESSING'];

function isRefundable(order) {
  return order.paymentStatus === 'PAID' && order.paymentMethod !== 'COD';
}

async function creditWallet({ userId, amount, orderId }) {
  if (!(amount > 0)) return null;
  const customer = await Customer.findOneAndUpdate({ _id: userId }, { $inc: { walletBalance: amount } }, { new: true });
  if (!customer) return null;
  return WalletTransaction.create({
    user: userId,
    type: 'CREDIT',
    amount,
    balanceAfter: customer.walletBalance,
    source: 'ORDER_REFUND',
    orderId,
    status: 'SUCCESS',
  });
}

/**
 * Pay the buyer back. Wallet by default (every standard-order refund in this
 * codebase). With `refundTo: 'original'` a Razorpay-paid order is refunded to
 * that payment instead; if Razorpay refuses, the buyer is not left waiting —
 * the amount goes to their wallet and admin is told, so nothing is lost
 * either way.
 */
async function payBack({ order, amount, refundTo = 'wallet' }) {
  if (!(amount > 0)) return null;
  const orderId = order._id;
  if (refundTo === 'original' && order.paymentMethod === 'RAZORPAY' && order.razorpayPaymentId) {
    try {
      await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: toPaise(amount),
        speed: 'optimum',
        notes: { orderId: String(orderId), reason: 'auto-cancel: not accepted by seller' },
      });
      return { destination: 'RAZORPAY' };
    } catch (err) {
      const why = err?.error?.description || err.message;
      console.error(`Razorpay refund failed for order ${orderId}, credited to wallet instead: ${why}`);
      await alertAdmins({
        event: 'AUTO_CANCEL_REFUND_FALLBACK',
        title: 'Refund went to wallet',
        message: `Razorpay refused the refund of ₹${amount} for auto-cancelled order ${orderId} (${why}). The buyer was credited to their wallet instead.`,
        link: `/admin/orders/detail/${orderId}`,
        key: `AUTO_CANCEL_REFUND_FALLBACK:${orderId}:${toPaise(amount)}`,
      }).catch(() => {});
    }
  }
  await creditWallet({ userId: order.user, amount, orderId });
  return { destination: 'WALLET' };
}

function releaseLineStock(item) {
  return item.variantId
    ? Product.updateOne(
        { _id: item.product, 'variants._id': item.variantId },
        { $inc: { 'variants.$.stock': item.quantity } }
      )
    : Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
}

/**
 * What a whole-order cancellation still owes the buyer: the total, less
 * whatever single-line cancellations have already paid back.
 */
function remainingRefund(order) {
  return Math.max(0, (toPaise(order.total) - toPaise(order.refundedAmount || 0)) / 100);
}

/**
 * Cancel one line of a STANDARD order.
 *
 * @param {object}  args
 * @param {*}       args.orderId
 * @param {number}  args.lineIndex
 * @param {string}  args.cancelledBy     'seller' | 'admin' | 'system'
 * @param {string}  [args.refundTo]      'wallet' (default) | 'original' (the Razorpay payment, wallet if refused)
 * @param {string}  [args.reason]
 * @param {*}       [args.vendorId]      when set, the line must belong to this seller
 * @returns {Promise<{ok:boolean,status?:number,message?:string,order?:object,item?:object,refunded?:number}>}
 */
async function cancelLine({ orderId, lineIndex, cancelledBy, reason = '', vendorId = null, refundTo = 'wallet' }) {
  const current = await Order.findById(orderId);
  if (!current) return { ok: false, status: 404, message: 'Order not found' };
  const item = current.items[lineIndex];
  if (!item) return { ok: false, status: 404, message: 'Item not found on this order' };
  if (vendorId && String(item.vendor) !== String(vendorId)) {
    return { ok: false, status: 404, message: 'Item not found on this order' };
  }
  if (await isDropshipOrder(current)) {
    return { ok: false, status: 400, message: 'Dropshipping orders are cancelled as a whole, from the order screen' };
  }

  const refundable = isRefundable(current);
  // This line's share of what the buyer paid, shipping aside.
  const lineRefund = refundable ? Math.min(linePaidPaise(current, lineIndex) / 100, remainingRefund(current)) : 0;

  const at = new Date();
  const path = `items.${lineIndex}`;
  // Claim the line and book its refund in ONE atomic update: the status
  // filter means a double click, or a seller and an admin at once, can only
  // ever cancel — and refund — it once.
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, [`${path}.status`]: { $in: CANCELLABLE_LINE_STATUSES } },
    {
      $set: {
        [`${path}.status`]: 'CANCELLED',
        ...(reason ? { [`${path}.rejectionReason`]: String(reason).slice(0, 500) } : {}),
      },
      $push: { [`${path}.statusHistory`]: { status: 'CANCELLED', at } },
      $inc: { refundedAmount: lineRefund },
    },
    { new: true }
  );
  if (!claimed) {
    return { ok: false, status: 400, message: `Cannot cancel an item that is ${item.status}` };
  }

  await releaseLineStock(item);

  let refunded = 0;
  if (lineRefund > 0) {
    await payBack({ order: claimed, amount: lineRefund, refundTo });
    refunded += lineRefund;
    try {
      await accounting.postLineCancellationRefund({ order: claimed.toObject(), lineIndex });
    } catch (err) {
      console.error('Accounting posting failed (line cancellation), will be reconciled on next read:', err.message);
    }
  }

  // Every line cancelled: the order is, too, and whatever is left of what the
  // buyer paid (the delivery charge) goes back. Guarded on status, and the
  // remainder read from the document it replaced, so this also runs once.
  let order = claimed;
  if (claimed.items.every((line) => line.status === 'CANCELLED') && claimed.status !== 'CANCELLED') {
    const before = await Order.findOneAndUpdate(
      { _id: orderId, status: { $ne: 'CANCELLED' } },
      [
        {
          $set: {
            status: 'CANCELLED',
            cancelledBy: ['admin', 'system'].includes(cancelledBy) ? cancelledBy : 'seller',
            statusHistory: { $concatArrays: ['$statusHistory', [{ status: 'CANCELLED', at }]] },
            refundedAmount: refundable ? '$total' : '$refundedAmount',
            paymentStatus: refundable ? 'REFUNDED' : '$paymentStatus',
          },
        },
      ],
      { new: false, updatePipeline: true }
    );
    if (before) {
      const rest = refundable ? remainingRefund(before) : 0;
      if (rest > 0) {
        await payBack({ order: before, amount: rest, refundTo });
        refunded += rest;
        // The remainder is the platform fee and shipping: reverse them too.
        try {
          await accounting.postOrderCancellationRefund({ order: { ...before.toObject(), paymentStatus: 'REFUNDED' } });
        } catch (err) {
          console.error('Accounting posting failed (order cancellation), will be reconciled on next read:', err.message);
        }
      }
      const { releaseCouponIfWholeCheckoutCancelled } = require('./externalOrderRefundService');
      await releaseCouponIfWholeCheckoutCancelled({ ...before.toObject(), status: 'CANCELLED' });
      order = await Order.findById(orderId);
    }
  }

  // A parcel whose every item is now cancelled is cancelled at the carrier.
  // Lazy: shipmentService pulls in the carrier client.
  await require('./shipping/shipmentService').cancelShipmentsForOrder({
    orderId,
    reason: reason || 'Item cancelled',
    actor: cancelledBy === 'admin' || cancelledBy === 'system' ? 'ADMIN' : 'SELLER',
  });

  return { ok: true, order, item: order.items[lineIndex], refunded };
}

/**
 * Refund what a whole-order cancellation still owes, to the wallet. Called
 * AFTER the caller has atomically moved the order to CANCELLED, so it runs
 * once per order.
 */
async function refundCancelledOrderToWallet(order, { feePercent = 0 } = {}) {
  if (!isRefundable(order)) return { refund: 0, fee: 0 };
  const owed = remainingRefund(order);
  // The platform keeps feePercent of what is still owed (a buyer-initiated
  // cancellation); everything else goes back. Whole paise, fee rounded down.
  const fee = feePercent > 0 ? Math.floor((toPaise(owed) * feePercent) / 100) / 100 : 0;
  const refund = Math.round((toPaise(owed) - toPaise(fee))) / 100;
  await Order.updateOne(
    { _id: order._id },
    { $set: { paymentStatus: 'REFUNDED', refundedAmount: Math.round(toPaise(order.total) - toPaise(fee)) / 100, cancellationFee: fee } }
  );
  if (refund > 0) await creditWallet({ userId: order.user, amount: refund, orderId: order._id });
  return { refund, fee };
}

/**
 * The manual "refund this cancelled order" action. Claims the refund
 * atomically — paymentStatus flips to REFUNDED in the same update that finds
 * the order — so a second click finds nothing to claim.
 */
async function claimCancelledOrderRefund(orderId) {
  const before = await Order.findOneAndUpdate(
    { _id: orderId, status: 'CANCELLED', paymentStatus: 'PAID', paymentMethod: { $ne: 'COD' } },
    [{ $set: { paymentStatus: 'REFUNDED', refundedAmount: '$total' } }],
    { new: false, updatePipeline: true }
  );
  if (!before) return 0;
  const amount = remainingRefund(before);
  if (amount > 0) await creditWallet({ userId: before.user, amount, orderId: before._id });
  return amount;
}

module.exports = {
  cancelLine,
  refundCancelledOrderToWallet,
  claimCancelledOrderRefund,
  remainingRefund,
  CANCELLABLE_LINE_STATUSES,
};
