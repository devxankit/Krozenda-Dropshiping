const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const WalletTransaction = require('../Models/WalletTransaction');
const AccountingTransaction = require('../Models/AccountingTransaction');
const { createNotification } = require('../Controllers/notificationController');
const posting = require('./accountingPosting');
const { toPaise } = require('../utils/money');

// Deciding a refund request, in ONE place.
//
// Both the older Finance > Refunds screen and Accounting > Refunds call this,
// so a refund approved from either surface credits the buyer's wallet, tells
// them about it and posts the same reversal to the ledger. Two copies of this
// logic would eventually approve refunds two different ways, and only one of
// them would be right.
//
// The money side is unchanged from what adminFinanceController always did —
// credit the wallet, write a WalletTransaction, notify. What is new is the
// accounting posting afterwards: a REFUND debit against the seller plus a
// proportional REFUND_REVERSAL credit giving back the commission that was
// charged on the part being refunded (task §9, §15 Rule 3).

/**
 * @param {object} options
 * @param {string} options.requestId
 * @param {'APPROVED'|'REJECTED'} options.decision
 * @param {string} [options.reason]
 * @param {object} [options.admin]  req.admin
 */
async function decideReturnRefund({ requestId, decision, reason = '', admin = null }) {
  if (!mongoose.isValidObjectId(requestId)) {
    return { ok: false, status: 400, message: 'Invalid refund id' };
  }
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return { ok: false, status: 400, message: 'Select a valid decision' };
  }

  // Status-guarded, so a double-clicked Approve can only win once and the
  // wallet is credited exactly once (task §22 case 8).
  const request = await ReturnRequest.findOneAndUpdate(
    { _id: requestId, status: 'PENDING' },
    { $set: { status: decision, adminNote: String(reason || '').trim(), resolvedAt: new Date() } },
    { new: true }
  ).populate('user', 'name');

  if (!request) {
    const exists = await ReturnRequest.exists({ _id: requestId });
    return {
      ok: false,
      status: exists ? 409 : 404,
      message: exists ? 'This refund has already been decided' : 'Refund request not found',
    };
  }

  let posted = { posted: 0 };

  if (decision === 'APPROVED') {
    const user = await Customer.findByIdAndUpdate(
      request.user._id,
      { $inc: { walletBalance: request.refundAmount } },
      { new: true }
    );
    await WalletTransaction.create({
      user: request.user._id,
      type: 'CREDIT',
      amount: request.refundAmount,
      balanceAfter: user.walletBalance,
      source: 'ORDER_REFUND',
      orderId: request.order,
      status: 'SUCCESS',
    });

    // Accounting impact. Never fatal: the buyer has already been refunded, so
    // failing the request here would leave them paid and the admin believing
    // nothing happened. The read-time reconciler picks up anything missed.
    try {
      posted = await posting.postReturnRefund({
        returnRequest: request.toObject(),
        createdBy: admin?._id || null,
      });
    } catch (err) {
      console.error('Refund posted to wallet but not to the ledger', {
        requestId: String(request._id),
        error: err.message,
      });
    }
  }

  await createNotification({
    userId: request.user._id,
    type: 'ORDER',
    title: decision === 'APPROVED' ? 'Refund Approved' : 'Refund Declined',
    message:
      decision === 'APPROVED'
        ? `Your refund of ₹${request.refundAmount.toLocaleString('en-IN')} has been credited to your wallet.`
        : `Your refund request was declined.${reason ? ` Reason: ${reason}` : ''}`,
    actionType: decision === 'APPROVED' ? 'WALLET' : 'ORDER',
    actionRefId: decision === 'APPROVED' ? null : request.order,
  });

  return { ok: true, request, posted };
}

// ---------------------------------------------------------------------------
// The refunds view
// ---------------------------------------------------------------------------

const REFUND_STATUS = Object.freeze({
  PENDING: 'REQUESTED',
  APPROVED: 'COMPLETED',
  REJECTED: 'CANCELLED',
});

/**
 * Every refund on the platform, from both places one can happen: a per-item
 * return request, and a whole order being cancelled after payment. Neither is
 * a "Refund model" of its own — inventing one would duplicate records the
 * platform already has — so the list is assembled from both and carries the
 * seller attribution and ledger status the older screen could not show.
 */
async function listAllRefunds({ range = null } = {}) {
  const dateFilter = range ? { createdAt: { $gte: range.from, $lte: range.to } } : {};

  const [returnRequests, cancelledOrders] = await Promise.all([
    ReturnRequest.find({ requestType: 'REFUND', ...dateFilter })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .lean(),
    Order.find({ status: 'CANCELLED', paymentStatus: 'REFUNDED', ...dateFilter })
      .populate('user', 'name')
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const orderIds = [
    ...new Set([
      ...returnRequests.map((request) => String(request.order)),
      ...cancelledOrders.map((order) => String(order._id)),
    ]),
  ];

  const [orders, ledgerRows] = await Promise.all([
    Order.find({ _id: { $in: orderIds } }).select('items paymentMethod total').lean(),
    AccountingTransaction.find({ order: { $in: orderIds }, type: 'REFUND' })
      .select('order product returnRequest debit')
      .lean(),
  ]);

  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  const postedByReturn = new Set(ledgerRows.filter((row) => row.returnRequest).map((row) => String(row.returnRequest)));
  const postedByOrder = new Map();
  for (const row of ledgerRows) {
    const key = String(row.order);
    postedByOrder.set(key, (postedByOrder.get(key) || 0) + row.debit);
  }

  const vendorIds = new Set();
  for (const order of orders) {
    for (const item of order.items) if (item.vendor) vendorIds.add(String(item.vendor));
  }
  const Vendor = require('../Models/Vendor');
  const vendors = await Vendor.find({ _id: { $in: [...vendorIds] } })
    .select('name business.businessName')
    .lean();
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));
  const sellerName = (id) => {
    const vendor = vendorById.get(String(id));
    return vendor?.business?.businessName || vendor?.name || '';
  };

  const fromReturns = returnRequests.map((request) => {
    const order = orderById.get(String(request.order));
    const line = order?.items.find((item) => String(item.product) === String(request.product));
    return {
      id: `return:${request._id}`,
      rawId: String(request._id),
      kind: 'RETURN',
      refundId: `RFD-${String(request._id).slice(-8).toUpperCase()}`,
      orderId: String(request.order),
      orderNumber: `ORD-${String(request.order).slice(-8).toUpperCase()}`,
      sellerId: line?.vendor ? String(line.vendor) : null,
      seller: line?.vendor ? sellerName(line.vendor) : 'Platform',
      customer: request.user?.name || '',
      amount: toPaise(request.refundAmount || 0),
      refundType: 'PARTIAL',
      reason: request.reason,
      paymentMethod: order?.paymentMethod || null,
      status: REFUND_STATUS[request.status] || 'REQUESTED',
      ledgerPosted: postedByReturn.has(String(request._id)),
      productName: request.productName,
      createdAt: request.createdAt,
      completedAt: request.status === 'APPROVED' ? request.resolvedAt : null,
      adminNote: request.adminNote || '',
      canDecide: request.status === 'PENDING',
    };
  });

  const fromCancellations = cancelledOrders.map((order) => {
    const sellers = [...new Set(order.items.filter((item) => item.vendor).map((item) => String(item.vendor)))];
    return {
      id: `order:${order._id}`,
      rawId: String(order._id),
      kind: 'CANCELLATION',
      refundId: `RFD-${String(order._id).slice(-8).toUpperCase()}`,
      orderId: String(order._id),
      orderNumber: `ORD-${String(order._id).slice(-8).toUpperCase()}`,
      sellerId: sellers.length === 1 ? sellers[0] : null,
      seller: sellers.length === 1 ? sellerName(sellers[0]) : `${sellers.length} sellers`,
      customer: order.user?.name || '',
      amount: toPaise(order.total),
      refundType: 'FULL',
      reason: 'Order cancelled',
      paymentMethod: order.paymentMethod,
      status: 'COMPLETED',
      ledgerPosted: (postedByOrder.get(String(order._id)) || 0) > 0,
      productName: null,
      createdAt: order.updatedAt,
      completedAt: order.updatedAt,
      adminNote: '',
      // Already resolved at the moment it happened — there is no decision
      // left to make on it.
      canDecide: false,
    };
  });

  return [...fromReturns, ...fromCancellations].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

module.exports = { decideReturnRefund, listAllRefunds, REFUND_STATUS };
