const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Customer = require('../Models/Customer');
const WalletTransaction = require('../Models/WalletTransaction');
const accounting = require('./accountingPosting');
const { linePaidPaise } = require('../utils/orderLines');
const { toPaise } = require('../utils/money');
const { isDropshipOrder } = require('../utils/dropship');

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
// instead, by dropshipOrderService, and are refused here.

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
 * @param {string}  args.cancelledBy     'seller' | 'admin'
 * @param {string}  [args.reason]
 * @param {*}       [args.vendorId]      when set, the line must belong to this seller
 * @returns {Promise<{ok:boolean,status?:number,message?:string,order?:object,item?:object,refunded?:number}>}
 */
async function cancelLine({ orderId, lineIndex, cancelledBy, reason = '', vendorId = null }) {
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
    await creditWallet({ userId: claimed.user, amount: lineRefund, orderId: claimed._id });
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
            cancelledBy: cancelledBy === 'admin' ? 'admin' : 'seller',
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
        await creditWallet({ userId: before.user, amount: rest, orderId: before._id });
        refunded += rest;
      }
      const { releaseCouponIfWholeCheckoutCancelled } = require('./dropshipOrderService');
      await releaseCouponIfWholeCheckoutCancelled({ ...before.toObject(), status: 'CANCELLED' });
      order = await Order.findById(orderId);
    }
  }

  // A parcel whose every item is now cancelled is cancelled at the carrier.
  // Lazy: shipmentService pulls in the carrier client.
  await require('./shipping/shipmentService').cancelShipmentsForOrder({
    orderId,
    reason: reason || 'Item cancelled',
    actor: cancelledBy === 'admin' ? 'ADMIN' : 'SELLER',
  });

  return { ok: true, order, item: order.items[lineIndex], refunded };
}

/**
 * Refund what a whole-order cancellation still owes, to the wallet. Called
 * AFTER the caller has atomically moved the order to CANCELLED, so it runs
 * once per order.
 */
async function refundCancelledOrderToWallet(order) {
  if (!isRefundable(order)) return 0;
  const amount = remainingRefund(order);
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'REFUNDED', refundedAmount: order.total } });
  if (amount > 0) await creditWallet({ userId: order.user, amount, orderId: order._id });
  return amount;
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
