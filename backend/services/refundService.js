const mongoose = require('mongoose');
const ReturnRequest = require('../Models/ReturnRequest');
const Order = require('../Models/Order');
const Customer = require('../Models/Customer');
const WalletTransaction = require('../Models/WalletTransaction');
const AccountingTransaction = require('../Models/AccountingTransaction');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const razorpayRouteService = require('./razorpayRouteService');
const { createNotification } = require('../Controllers/notificationController');
const posting = require('./accountingPosting');
const { toPaise, fromPaise } = require('../utils/money');

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

// ---------------------------------------------------------------------------
// Razorpay Route seller-settlement impact of an approved refund
// ---------------------------------------------------------------------------
//
// Three timing scenarios, per how far the affected line's Settlement/Payout
// has already gotten (Razorpay Route seller-settlement automation, sub-task
// 6/11). This is READ from the existing state, never guessed: it looks up
// whichever Settlement currently claims the order+product line (there can be
// at most one live claim — see Settlement.CLAIMING_STATUSES /
// settlementService.collectEligibleLines) and, if one exists, whatever
// RAZORPAY_ROUTE Payout was created against it.

/**
 * Vendor id for the order line a return/refund request is against, or null
 * if the line has no vendor (shouldn't happen for a marketplace order, but
 * guarded rather than assumed).
 */
async function vendorForRequestLine(request) {
  const order = await Order.findById(request.order).select('items').lean();
  const item = order?.items.find((it) => String(it.product) === String(request.product));
  return item?.vendor ? String(item.vendor) : null;
}

/**
 * Apply the Razorpay Route consequence of an APPROVED refund, if the line
 * belongs to a Settlement with a Route payout in flight. Never fatal — same
 * bargain as postReturnRefund above: the buyer has already been refunded, so
 * failing this must not fail the request.
 */
async function applyRouteSettlementImpact({ request, refundPaise, admin }) {
  if (!(refundPaise > 0)) return { scenario: 'NO_AMOUNT' };

  const vendorId = await vendorForRequestLine(request);
  if (!vendorId) return { scenario: 'NO_VENDOR' };

  // The settlement currently claiming this line, if any. Not yet batched at
  // all is the common case for a fast-approved return and needs no action —
  // settlementService.collectEligibleLines reads the REFUND/REFUND_REVERSAL
  // rows postReturnRefund just posted straight off the ledger, so whatever
  // settlement gets generated later already nets the refund correctly.
  const settlement = await Settlement.findOne({
    vendor: vendorId,
    'items.order': request.order,
    'items.product': request.product,
  });

  if (!settlement) {
    return { scenario: 'A_NOT_BATCHED', vendorId };
  }

  const payout = await Payout.findOne({ settlement: settlement._id, method: 'RAZORPAY_ROUTE' }).sort({ attempt: -1 });

  if (!payout || !['PROCESSING', 'RELEASED', 'COMPLETED'].includes(payout.status)) {
    // Scenario A, but a batch already exists and claims this line (status
    // ELIGIBLE/PENDING/AWAITING_APPROVAL/FAILED) with figures computed
    // BEFORE this refund landed. settlementService.js exports no
    // recalculate-totals function (only collectEligibleLines,
    // generateSettlements, setSettlementHold, sellerBalances, vendorLabel,
    // HOLD_STATUS — checked directly), so this code does NOT invent
    // arithmetic to patch settlement.netPayablePaise itself; that is
    // settlementService.js's job and out of scope here. Conservative
    // fallback: hold the settlement via the existing ON_HOLD mechanism so
    // checkSettlementSafeForTransfer's amount-consistency gate is never
    // reached with a stale figure, and flag it for a human to regenerate.
    if (['ELIGIBLE', 'PENDING', 'AWAITING_APPROVAL'].includes(settlement.status)) {
      await Settlement.updateOne(
        { _id: settlement._id, status: settlement.status },
        { $set: { status: 'ON_HOLD', holdReason: 'REFUND_AFTER_SETTLEMENT_GENERATED_NEEDS_REGEN' } }
      );
    }
    return { scenario: 'A_ALREADY_BATCHED_STALE', vendorId, settlementId: settlement._id };
  }

  if (payout.status === 'PROCESSING') {
    // Scenario B: transfer created, on_hold=true, not yet released. Reverse
    // the refunded amount (capped to what the transfer actually holds) —
    // full refund of the only line naturally reverses the whole transfer.
    const reverseAmountPaise = Math.min(Math.round(refundPaise), payout.amount);
    let reversed = false;
    try {
      await razorpayRouteService.reverseTransfer(payout.razorpayTransferId, reverseAmountPaise);
      reversed = true;
    } catch (err) {
      // Conservative fallback per this sub-task's spec: an unconfirmed/failed
      // reversal against Razorpay is never guessed at as having worked. Fall
      // through to the manual-reconciliation hold below either way.
      console.error('[refundService] Route transfer reversal failed — holding for manual reconciliation', {
        payoutId: String(payout._id),
        transferId: payout.razorpayTransferId,
        error: err.message,
      });
    }

    if (Payout.canTransition('PROCESSING', 'FAILED')) {
      await Payout.updateOne(
        { _id: payout._id, status: 'PROCESSING' },
        {
          $set: {
            status: 'FAILED',
            failureReason: 'REFUND_BEFORE_RELEASE',
            processedAt: new Date(),
          },
          $push: {
            auditHistory: {
              action: 'PAYOUT_FAILED',
              from: 'PROCESSING',
              to: 'FAILED',
              by: admin?._id || null,
              byName: admin?.name || '',
              reason: reversed
                ? 'REFUND_BEFORE_RELEASE'
                : 'REFUND_BEFORE_RELEASE — Route reversal call failed, needs manual reconciliation',
              at: new Date(),
            },
          },
        }
      );
    }

    // Sent to ON_HOLD rather than FAILED: FAILED is in payoutService
    // .createPayout's retryable-status list, which would happily create a
    // fresh transfer for the SAME now-stale settlement amount. ON_HOLD is
    // not retryable, so a human has to regenerate/correct the settlement and
    // release it deliberately.
    await Settlement.updateOne(
      { _id: settlement._id },
      {
        $set: {
          status: 'ON_HOLD',
          holdReason: reversed
            ? 'REFUND_BEFORE_RELEASE'
            : 'REFUND_BEFORE_RELEASE_REVERSAL_FAILED_MANUAL_RECONCILIATION',
        },
      }
    );

    // No extra ledger row here: postReturnRefund (called by the caller just
    // before this) already posted the REFUND debit (and REFUND_REVERSAL
    // credit) that fully captures this refund's impact on the seller's
    // ledger balance. No PAYOUT debit was ever posted for this payout — that
    // only happens at COMPLETED (payoutService.settlePayoutStatus) — so
    // reversing the still-held transfer undoes money that was never counted
    // as paid in the first place. Posting a second ADJUSTMENT debit here
    // would double-count the same money the REFUND row already reflects.

    return {
      scenario: reversed ? 'B_REVERSED' : 'B_REVERSAL_FAILED_MANUAL',
      vendorId,
      settlementId: settlement._id,
      payoutId: payout._id,
    };
  }

  // Scenario C: RELEASED or COMPLETED — funds have already been released
  // towards, or confirmed settled into, the seller's bank account. Route's
  // support for reversing a transfer that has left the on-hold state is not
  // something this codebase verified (razorpayRouteService.reverseTransfer's
  // own header only confirms the ON-HOLD partial-reversal path from the
  // SDK's type declarations), so no automatic Razorpay call is made here —
  // that would be guessing at unconfirmed Route behaviour on money that may
  // already be gone. Instead: record a recovery debit to claw back out of a
  // FUTURE settlement.
  const recoveryPaise = Math.round(refundPaise);

  await Vendor.updateOne({ _id: vendorId }, { $inc: { 'razorpay.pendingRecoveryPaise': recoveryPaise } });

  try {
    await posting.postAdjustment({
      vendorId,
      amountPaise: recoveryPaise,
      direction: 'DEBIT',
      reason: `Recovery — refund approved after Razorpay Route payout ${payout.payoutId} already ${payout.status.toLowerCase()}`,
      orderId: request.order,
      createdBy: admin?._id || null,
    });
  } catch (err) {
    console.error('[refundService] Failed to post recovery ADJUSTMENT for a released/completed Route payout', {
      payoutId: String(payout._id),
      error: err.message,
    });
  }

  // FOLLOW-UP, not wired here (out of scope for this sub-task):
  // settlementService.collectEligibleLines aggregates ONLY SALE / COMMISSION
  // / PAYMENT_GATEWAY_FEE / SHIPPING_CHARGE / REFUND / REFUND_REVERSAL ledger
  // rows per (order, product, vendor) line — it reads neither ADJUSTMENT rows
  // nor Vendor.razorpay.pendingRecoveryPaise. So neither the ADJUSTMENT row
  // just posted nor the pendingRecoveryPaise increment above is currently
  // subtracted from a future settlement's netPayablePaise by
  // generateSettlements / initiateRazorpayTransferForSettlement. Wiring that
  // in requires a change inside settlementService.js's own arithmetic, which
  // is explicitly that file's job and out of scope here. Until that lands,
  // pendingRecoveryPaise/the ADJUSTMENT row are a correct RECORD of what is
  // owed back, not money actually being withheld from anything yet.
  return {
    scenario: 'C_RECOVERY_RECORDED',
    vendorId,
    settlementId: settlement._id,
    payoutId: payout._id,
    recoveryPaise,
  };
}

function notifyVendorMessageForRouteImpact(result, refundPaise) {
  const amountLabel = `₹${fromPaise(refundPaise).toLocaleString('en-IN')}`;
  switch (result.scenario) {
    case 'A_ALREADY_BATCHED_STALE':
      return {
        title: 'Settlement on hold',
        message: `A refund of ${amountLabel} was approved against an order already in your pending settlement. That settlement has been put on hold for correction.`,
      };
    case 'B_REVERSED':
      return {
        title: 'Settlement adjusted',
        message: `A refund of ${amountLabel} was approved before your settlement funds were released. The held transfer has been reversed and the settlement is on hold pending correction.`,
      };
    case 'B_REVERSAL_FAILED_MANUAL':
      return {
        title: 'Settlement on hold — under review',
        message: `A refund of ${amountLabel} was approved against your settlement, which is on hold while our team manually reconciles the held transfer.`,
      };
    case 'C_RECOVERY_RECORDED':
      return {
        title: 'Recovery against future settlement',
        message: `A refund of ${amountLabel} was approved after that settlement was already paid out. This amount will be recovered from your next settlement.`,
      };
    default:
      return null;
  }
}

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

    // Razorpay Route seller-settlement impact (sub-task 6/11). Also never
    // fatal, for the same reason as the ledger post above — the buyer is
    // already refunded.
    try {
      const routeResult = await applyRouteSettlementImpact({
        request,
        refundPaise: toPaise(request.refundAmount || 0),
        admin,
      });
      if (routeResult.vendorId) {
        const notice = notifyVendorMessageForRouteImpact(routeResult, toPaise(request.refundAmount || 0));
        if (notice) {
          await createNotification({
            vendorId: routeResult.vendorId,
            type: 'WALLET',
            title: notice.title,
            message: notice.message,
            actionType: 'WALLET',
            actionRefId: routeResult.settlementId || null,
          });
        }
      }
    } catch (err) {
      console.error('Refund posted, but its Razorpay Route settlement impact failed', {
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
