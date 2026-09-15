const mongoose = require('mongoose');
const crypto = require('crypto');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const Settlement = require('../Models/Settlement');
const ReturnRequest = require('../Models/ReturnRequest');
const WalletTransaction = require('../Models/WalletTransaction');
const User = require('../Models/User');
const Product = require('../Models/Product');
const { createNotification } = require('./notificationController');
const { toPaise } = require('../utils/money');

// A line becomes payable once it's been DELIVERED for this many days — no
// real "return window elapsed" signal exists beyond time, so this mirrors
// the buyer-facing return window (returnController.RETURN_WINDOW_DAYS).
const HOLD_DAYS = 7;
const DEFAULT_COMMISSION_RATE = 10;

const SETTLEMENT_STATUS_OUT = Object.freeze({
  AWAITING_APPROVAL: 'awaiting_approval',
  SETTLED: 'settled',
  FAILED: 'failed',
});

function vendorLabel(v) {
  return v?.business?.businessName || v?.name || 'Unknown seller';
}

function paged(items, { page = 1, rowsPerPage = 25 }, tabCounts) {
  const perPage = Number(rowsPerPage) || 25;
  const currentPage = Number(page) || 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const start = (currentPage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: currentPage,
    rowsPerPage: perPage,
    totalItems,
    totalPages,
    tabCounts,
  };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

async function getOverview(req, res) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [revenueAgg, refundAgg, unreconciledCount, awaitingSettlements, openRefundsCount, cashRows] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    WalletTransaction.aggregate([
      { $match: { source: 'ORDER_REFUND', type: 'CREDIT', status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Order.countDocuments({ paymentStatus: 'PAID', financeReconciled: false }),
    Settlement.aggregate([
      { $match: { status: 'AWAITING_APPROVAL' } },
      { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
    ]),
    ReturnRequest.countDocuments({ requestType: 'REFUND', status: 'PENDING' }),
    Order.aggregate([
      { $match: { paymentStatus: 'PAID', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalRefunded = refundAgg[0]?.total || 0;
  const pendingSettlementAmount = awaitingSettlements[0]?.total || 0;
  const pendingSettlementCount = awaitingSettlements[0]?.count || 0;

  const holdSplit = await Order.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.status': 'DELIVERED', 'items.vendor': { $ne: null } } },
    {
      $group: {
        _id: { $cond: [{ $lte: ['$deliveredAt', new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000)] }, 'eligible', 'hold'] },
        total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
  ]);
  const holdMap = Object.fromEntries(holdSplit.map((r) => [r._id, r.total]));

  res.json({
    success: true,
    data: {
      kpis: [
        { key: 'revenue', label: 'Total Revenue', value: toPaise(totalRevenue), format: 'money', delta: null, caption: 'All-time captured payments', tone: 'brand' },
        { key: 'pending_settlement', label: 'Pending Settlement', value: toPaise(pendingSettlementAmount), format: 'money', delta: null, caption: `${pendingSettlementCount} batches awaiting approval` },
        { key: 'refunded', label: 'Total Refunded', value: toPaise(totalRefunded), format: 'money', delta: null, caption: 'Credited back to buyer wallets' },
        { key: 'unreconciled', label: 'Unreconciled Payments', value: unreconciledCount, format: 'count', delta: null, caption: 'Not yet matched to a statement' },
      ],
      cashPosition: cashRows.map((r) => ({ label: r._id, inflow: toPaise(r.total), outflow: 0 })),
      holdBuckets: [
        { label: 'In hold window', value: toPaise(holdMap.hold || 0) },
        { label: 'Eligible for payout', value: toPaise(holdMap.eligible || 0) },
      ],
      attention: [
        pendingSettlementCount > 0 && {
          id: 'settlements',
          title: `${pendingSettlementCount} settlement batches await approval`,
          detail: 'Maker-checker: release with a two-factor code',
          amount: toPaise(pendingSettlementAmount),
          tone: 'warning',
          to: '/admin/finance/settlements',
        },
        openRefundsCount > 0 && {
          id: 'refunds',
          title: `${openRefundsCount} refund requests are open`,
          detail: 'Waiting on a process/decline decision',
          amount: 0,
          tone: 'danger',
          to: '/admin/finance/refunds',
        },
      ].filter(Boolean),
    },
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

const PAYMENT_STATUS_OUT = { PENDING: 'pending', PAID: 'captured', FAILED: 'failed', REFUNDED: 'refunded' };
const METHOD_LABEL = { COD: 'Cash on delivery', WALLET: 'Wallet', RAZORPAY: 'Razorpay' };

function serializeTransaction(o) {
  return {
    id: o._id.toString(),
    reference: o.razorpayPaymentId || `COD-${o._id.toString().slice(-8).toUpperCase()}`,
    orderId: o._id.toString(),
    buyer: o.user?.name || '',
    method: METHOD_LABEL[o.paymentMethod] || o.paymentMethod,
    status: PAYMENT_STATUS_OUT[o.paymentStatus] || 'pending',
    capturedAt: o.createdAt,
    gross: toPaise(o.total),
    fee: 0,
    net: toPaise(o.total),
    reconciled: Boolean(o.financeReconciled),
  };
}

async function listTransactions(req, res) {
  const { tab, status, search, page, rowsPerPage } = req.query;

  const orders = await Order.find().populate('user', 'name').sort({ createdAt: -1 }).lean();
  const allSerialized = orders.map(serializeTransaction);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((t) => t.reference.toLowerCase().includes(term) || t.orderId.includes(term) || t.buyer.toLowerCase().includes(term));
  }

  const effective = status || (tab && tab !== 'all' ? tab : null);
  if (effective === 'captured') items = items.filter((t) => t.status === 'captured');
  else if (effective === 'refunds') items = items.filter((t) => t.status === 'refunded');
  else if (effective === 'failed') items = items.filter((t) => t.status === 'failed');
  else if (effective === 'unreconciled') items = items.filter((t) => !t.reconciled);
  else if (effective && effective !== 'all') items = items.filter((t) => t.status === effective);

  const tabCounts = {
    all: allSerialized.length,
    captured: allSerialized.filter((t) => t.status === 'captured').length,
    refunds: allSerialized.filter((t) => t.status === 'refunded').length,
    failed: allSerialized.filter((t) => t.status === 'failed').length,
    unreconciled: allSerialized.filter((t) => !t.reconciled).length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function reconcileTransaction(req, res) {
  const { id } = req.params;
  const { reconciled = true } = req.body;

  const order = await Order.findByIdAndUpdate(id, { $set: { financeReconciled: Boolean(reconciled) } }, { new: true }).populate('user', 'name');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }
  res.json({ success: true, message: 'Reconciliation updated', data: serializeTransaction(order) });
}

async function bulkReconcileTransactions(req, res) {
  const { ids = [] } = req.body;
  const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
  await Order.updateMany({ _id: { $in: validIds } }, { $set: { financeReconciled: true } });
  res.json({ success: true, message: 'Payments reconciled', data: { ids: validIds } });
}

// ---------------------------------------------------------------------------
// Refunds — union of per-item ReturnRequest(REFUND) decisions and full-order
// cancellation refunds (already resolved at the moment they happened).
// ---------------------------------------------------------------------------

const REFUND_STATUS_OUT = { PENDING: 'pending', APPROVED: 'completed', REJECTED: 'declined' };

async function listRefunds(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const [returnRefunds, cancelledOrders] = await Promise.all([
    ReturnRequest.find({ requestType: 'REFUND' }).populate('user', 'name').sort({ createdAt: -1 }).lean(),
    Order.find({ status: 'CANCELLED', paymentStatus: 'REFUNDED' }).populate('user', 'name').lean(),
  ]);

  const fromReturns = returnRefunds.map((r) => ({
    id: `return:${r._id}`,
    reference: `RFD-${r._id.toString().slice(-8).toUpperCase()}`,
    subOrderId: r.order.toString().slice(-8).toUpperCase(),
    buyer: r.user?.name || '',
    reason: r.reason,
    requestedAt: r.createdAt,
    isPartial: true,
    status: REFUND_STATUS_OUT[r.status] || 'pending',
    amount: toPaise(r.refundAmount || 0),
    transferReversed: r.status === 'APPROVED',
  }));

  const fromCancellations = cancelledOrders.map((o) => ({
    id: `order:${o._id}`,
    reference: `RFD-${o._id.toString().slice(-8).toUpperCase()}`,
    subOrderId: o._id.toString().slice(-8).toUpperCase(),
    buyer: o.user?.name || '',
    reason: 'Order cancelled',
    requestedAt: o.updatedAt,
    isPartial: false,
    status: 'completed',
    amount: toPaise(o.total),
    transferReversed: true,
  }));

  const allSerialized = [...fromReturns, ...fromCancellations].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((r) => r.reference.toLowerCase().includes(term) || r.subOrderId.toLowerCase().includes(term) || r.buyer.toLowerCase().includes(term));
  }

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'open') items = items.filter((r) => r.status === 'pending' || r.status === 'processing');
  else if (effectiveTab === 'partial') items = items.filter((r) => r.isPartial);
  else if (effectiveTab === 'failed') items = items.filter((r) => r.status === 'failed');
  else if (effectiveTab === 'completed') items = items.filter((r) => r.status === 'completed');

  const tabCounts = {
    all: allSerialized.length,
    open: allSerialized.filter((r) => r.status === 'pending' || r.status === 'processing').length,
    partial: allSerialized.filter((r) => r.isPartial).length,
    failed: allSerialized.filter((r) => r.status === 'failed').length,
    completed: allSerialized.filter((r) => r.status === 'completed').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function decideRefund(req, res, decision) {
  const { id } = req.params;
  const { reason } = req.body;

  if (!id.startsWith('return:')) {
    return res.status(400).json({ success: false, message: 'This refund is already resolved and cannot be changed here' });
  }
  const rawId = id.slice('return:'.length);

  const request = await ReturnRequest.findOneAndUpdate(
    { _id: rawId, status: 'PENDING' },
    { $set: { status: decision, adminNote: reason || '', resolvedAt: new Date() } },
    { new: true }
  ).populate('user', 'name');
  if (!request) {
    return res.status(404).json({ success: false, message: 'Refund request not found or already decided' });
  }

  if (decision === 'APPROVED') {
    const user = await User.findByIdAndUpdate(request.user._id, { $inc: { walletBalance: request.refundAmount } }, { new: true });
    await WalletTransaction.create({
      user: request.user._id,
      type: 'CREDIT',
      amount: request.refundAmount,
      balanceAfter: user.walletBalance,
      source: 'ORDER_REFUND',
      orderId: request.order,
      status: 'SUCCESS',
    });
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

  res.json({
    success: true,
    message: `Refund ${decision === 'APPROVED' ? 'processed' : 'declined'}`,
    data: {
      id: `return:${request._id}`,
      reference: `RFD-${request._id.toString().slice(-8).toUpperCase()}`,
      subOrderId: request.order.toString().slice(-8).toUpperCase(),
      buyer: request.user?.name || '',
      reason: request.reason,
      requestedAt: request.createdAt,
      isPartial: true,
      status: REFUND_STATUS_OUT[request.status],
      amount: toPaise(request.refundAmount || 0),
      transferReversed: request.status === 'APPROVED',
    },
  });
}

const processRefund = (req, res) => decideRefund(req, res, 'APPROVED');
const rejectRefund = (req, res) => decideRefund(req, res, 'REJECTED');

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

function serializeSettlement(s) {
  return {
    id: s._id.toString(),
    vendor: vendorLabel(s.vendor),
    vendorId: s.vendor?._id ? s.vendor._id.toString() : s.vendor.toString(),
    scheduledFor: s.scheduledFor,
    subOrderCount: s.items.length,
    gross: toPaise(s.grossAmount),
    commission: toPaise(s.commissionAmount),
    tds: toPaise(s.tdsAmount || 0),
    deductions: toPaise(s.deductions || 0),
    net: toPaise(s.netAmount),
    status: SETTLEMENT_STATUS_OUT[s.status] || 'awaiting_approval',
    mode: s.mode,
    utr: s.utr,
  };
}

// Auto-drafts a fresh AWAITING_APPROVAL batch per vendor for every delivered
// line that's past the hold window and not already claimed by an earlier
// batch. No cron exists yet, so this runs opportunistically on read — it's
// idempotent (the exclusion set below prevents double-booking a line).
async function draftEligibleSettlements() {
  const existing = await Settlement.find().select('items.order items.product').lean();
  const claimed = new Set();
  for (const s of existing) {
    for (const item of s.items) claimed.add(`${item.order}:${item.product}`);
  }

  const cutoff = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000);
  const orders = await Order.find({ 'items.status': 'DELIVERED', deliveredAt: { $lte: cutoff } }).lean();

  const byVendor = new Map();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.status !== 'DELIVERED' || !item.vendor) continue;
      const key = `${order._id}:${item.product}`;
      if (claimed.has(key)) continue;

      const vendorId = item.vendor.toString();
      if (!byVendor.has(vendorId)) byVendor.set(vendorId, []);
      byVendor.get(vendorId).push({
        order: order._id,
        product: item.product,
        name: item.name,
        quantity: item.quantity,
        gross: item.price * item.quantity,
        deliveredAt: order.deliveredAt,
      });
    }
  }

  if (byVendor.size === 0) return;

  const vendors = await Vendor.find({ _id: { $in: [...byVendor.keys()] } }).select('commissionRatePercent');
  const rateById = new Map(vendors.map((v) => [v._id.toString(), v.commissionRatePercent ?? DEFAULT_COMMISSION_RATE]));

  const batches = [];
  for (const [vendorId, lines] of byVendor) {
    const rate = rateById.get(vendorId) ?? DEFAULT_COMMISSION_RATE;
    let grossAmount = 0;
    let commissionAmount = 0;
    const items = lines.map((l) => {
      const commission = Math.round((l.gross * rate) / 100);
      grossAmount += l.gross;
      commissionAmount += commission;
      return { order: l.order, product: l.product, name: l.name, quantity: l.quantity, grossAmount: l.gross, commissionAmount: commission, netAmount: l.gross - commission, deliveredAt: l.deliveredAt };
    });
    batches.push({
      vendor: vendorId,
      items,
      grossAmount,
      commissionAmount,
      tdsAmount: 0,
      deductions: 0,
      netAmount: grossAmount - commissionAmount,
      status: 'AWAITING_APPROVAL',
      scheduledFor: new Date(),
    });
  }

  if (batches.length > 0) await Settlement.insertMany(batches);
}

async function listSettlements(req, res) {
  const { tab, status, search, page, rowsPerPage } = req.query;

  await draftEligibleSettlements();

  const settlements = await Settlement.find().populate('vendor', 'name business.businessName').sort({ createdAt: -1 }).lean();
  const allSerialized = settlements.map(serializeSettlement);

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) {
    items = items.filter((s) => s.id.includes(term) || s.vendor.toLowerCase().includes(term) || (s.utr || '').toLowerCase().includes(term));
  }

  const effective = status || (tab && tab !== 'all' ? tab : null);
  if (effective === 'awaiting') items = items.filter((s) => s.status === 'awaiting_approval');
  else if (effective === 'failed') items = items.filter((s) => s.status === 'failed');
  else if (effective === 'settled') items = items.filter((s) => s.status === 'settled');
  else if (effective === 'hold') items = [];
  else if (effective && effective !== 'all') items = items.filter((s) => s.status === effective);

  const tabCounts = {
    all: allSerialized.length,
    awaiting: allSerialized.filter((s) => s.status === 'awaiting_approval').length,
    hold: 0,
    failed: allSerialized.filter((s) => s.status === 'failed').length,
    settled: allSerialized.filter((s) => s.status === 'settled').length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function getSettlementBatch(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid batch id' });
  }

  const s = await Settlement.findById(id).populate('vendor', 'name business.businessName bank');
  if (!s) {
    return res.status(404).json({ success: false, message: 'Settlement batch not found' });
  }

  const bank = s.vendor?.bank || {};
  const masked = bank.accountNumber ? `•••• ${bank.accountNumber.slice(-4)}` : '—';

  res.json({
    success: true,
    data: {
      ...serializeSettlement(s),
      preparedBy: 'System (auto-drafted)',
      preparedAt: s.createdAt,
      approvalMode: 'maker_checker',
      fundAccount: { bank: bank.bankName || '—', accountMasked: masked, ifsc: bank.ifsc || '—' },
      lines: s.items.map((item) => ({
        subOrderId: `${item.order.toString().slice(-8).toUpperCase()}`,
        deliveredAt: item.deliveredAt,
        eligibleAt: new Date(new Date(item.deliveredAt).getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000),
        gross: toPaise(item.grossAmount),
        commission: toPaise(item.commissionAmount),
        tds: 0,
        net: toPaise(item.netAmount),
      })),
    },
  });
}

async function approveSettlement(req, res) {
  const { id } = req.params;
  const utr = `UTR${crypto.randomInt(0, 1000000000).toString().padStart(9, '0')}`;

  const s = await Settlement.findOneAndUpdate(
    { _id: id, status: 'AWAITING_APPROVAL' },
    { $set: { status: 'SETTLED', approvedAt: new Date(), approvedBy: req.admin._id, utr } },
    { new: true }
  ).populate('vendor', 'name business.businessName');
  if (!s) {
    return res.status(400).json({ success: false, message: 'Batch not found or not awaiting approval' });
  }

  await createNotification({
    vendorId: s.vendor._id,
    type: 'SYSTEM',
    title: 'Settlement Paid',
    message: `₹${(s.netAmount).toLocaleString('en-IN')} has been settled to your account (UTR ${utr}).`,
    actionType: 'NONE',
  });

  res.json({ success: true, message: 'Batch released', data: serializeSettlement(s) });
}

// Rejecting deletes the draft so its lines become eligible again on the next
// auto-draft pass — nothing was ever paid, so there's nothing to reverse.
async function rejectSettlement(req, res) {
  const { id } = req.params;
  const { reason } = req.body;

  const s = await Settlement.findOneAndUpdate(
    { _id: id, status: 'AWAITING_APPROVAL' },
    { $set: { rejectionReason: reason || '' } },
    { new: true }
  ).populate('vendor', 'name business.businessName');
  if (!s) {
    return res.status(400).json({ success: false, message: 'Batch not found or not awaiting approval' });
  }

  const responseBody = { ...serializeSettlement(s), status: 'reversed' };
  await Settlement.deleteOne({ _id: id });

  res.json({ success: true, message: 'Batch rejected', data: responseBody });
}

async function retrySettlement(req, res) {
  const { id } = req.params;
  const s = await Settlement.findOneAndUpdate({ _id: id, status: 'FAILED' }, { $set: { status: 'AWAITING_APPROVAL' } }, { new: true }).populate(
    'vendor',
    'name business.businessName'
  );
  if (!s) {
    return res.status(400).json({ success: false, message: 'Batch not found or not failed' });
  }
  res.json({ success: true, message: 'Batch queued for approval again', data: serializeSettlement(s) });
}

// ---------------------------------------------------------------------------
// Vendor ledgers
// ---------------------------------------------------------------------------

async function listVendorLedgers(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  const vendors = await Vendor.find({ isActive: true }).select('name business.businessName vendorType commissionRatePercent').lean();

  const [earningsByVendor, settledByVendor] = await Promise.all([
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.status': 'DELIVERED', 'items.vendor': { $ne: null } } },
      { $group: { _id: '$items.vendor', gross: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
    ]),
    Settlement.aggregate([
      { $match: { status: 'SETTLED' } },
      { $group: { _id: '$vendor', net: { $sum: '$netAmount' }, lastSettledAt: { $max: '$approvedAt' } } },
    ]),
  ]);

  const earningsMap = new Map(earningsByVendor.map((r) => [r._id.toString(), r.gross]));
  const settledMap = new Map(settledByVendor.map((r) => [r._id.toString(), r]));

  const allSerialized = vendors.map((v) => {
    const vid = v._id.toString();
    const rate = v.commissionRatePercent ?? DEFAULT_COMMISSION_RATE;
    const gross = earningsMap.get(vid) || 0;
    const credited = Math.round(gross * (1 - rate / 100));
    const settled = settledMap.get(vid);
    const debited = settled?.net || 0;
    return {
      id: vid,
      vendor: vendorLabel(v),
      model: v.vendorType,
      opening: 0,
      credited: toPaise(credited),
      debited: toPaise(debited),
      closing: toPaise(credited - debited),
      lastSettledAt: settled?.lastSettledAt || null,
    };
  });

  let items = allSerialized;
  const term = (search || '').trim().toLowerCase();
  if (term) items = items.filter((r) => r.vendor.toLowerCase().includes(term));

  const effectiveTab = tab && tab !== 'all' ? tab : null;
  if (effectiveTab === 'owing') items = items.filter((r) => r.closing > 0);
  else if (effectiveTab === 'settled') items = items.filter((r) => r.closing === 0 && r.credited > 0);
  else if (effectiveTab === 'never_settled') items = items.filter((r) => !r.lastSettledAt);

  const tabCounts = {
    all: allSerialized.length,
    owing: allSerialized.filter((r) => r.closing > 0).length,
    settled: allSerialized.filter((r) => r.closing === 0 && r.credited > 0).length,
    never_settled: allSerialized.filter((r) => !r.lastSettledAt).length,
  };

  res.json({ success: true, data: paged(items, { page, rowsPerPage }, tabCounts) });
}

async function getVendorStatement(req, res) {
  const { id } = req.params;
  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  const rate = vendor.commissionRatePercent ?? DEFAULT_COMMISSION_RATE;
  const [orders, settlements] = await Promise.all([
    Order.find({ 'items.vendor': vendor._id, 'items.status': 'DELIVERED' }).sort({ deliveredAt: 1 }),
    Settlement.find({ vendor: vendor._id, status: 'SETTLED' }).sort({ approvedAt: 1 }),
  ]);

  const entries = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (item.vendor?.toString() !== vendor._id.toString() || item.status !== 'DELIVERED') continue;
      const gross = item.price * item.quantity;
      const net = Math.round(gross * (1 - rate / 100));
      entries.push({ date: order.deliveredAt, particulars: `Order ${order._id.toString().slice(-8).toUpperCase()} — ${item.name}`, reference: order._id.toString().slice(-8).toUpperCase(), debit: 0, credit: net });
    }
  }
  for (const s of settlements) {
    entries.push({ date: s.approvedAt, particulars: `Settlement payout (${s.utr})`, reference: s.utr || '', debit: s.netAmount, credit: 0 });
  }
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = 0;
  const serializedEntries = entries.map((e, idx) => {
    balance += e.credit - e.debit;
    return { id: `${idx}`, date: e.date, particulars: e.particulars, reference: e.reference, debit: toPaise(e.debit), credit: toPaise(e.credit), balance: toPaise(balance) };
  });

  res.json({
    success: true,
    data: {
      vendorId: vendor._id.toString(),
      vendor: vendorLabel(vendor),
      gstin: vendor.business?.gstin || '',
      period: 'All time',
      opening: 0,
      closing: toPaise(balance),
      entries: serializedEntries,
    },
  });
}

// ---------------------------------------------------------------------------
// Commission rules — read-only view over Vendor.commissionRatePercent, plus
// one synthetic "default" row for the platform baseline. No arbitrary
// product/category rule engine exists (see accounting-scope trade-off).
// ---------------------------------------------------------------------------

async function listCommissionRules(req, res) {
  const vendors = await Vendor.find({ isActive: true }).select('name business.businessName commissionRatePercent updatedAt').lean();

  const productCounts = await Product.aggregate([{ $match: { vendor: { $ne: null } } }, { $group: { _id: '$vendor', count: { $sum: 1 } } }]);
  const countMap = new Map(productCounts.map((r) => [r._id.toString(), r.count]));

  const items = [
    {
      id: 'default',
      scope: 'default',
      target: 'All sellers',
      type: 'percentage',
      value: DEFAULT_COMMISSION_RATE,
      appliesTo: vendors.length,
      updatedAt: new Date(0).toISOString(),
    },
    ...vendors.map((v) => ({
      id: v._id.toString(),
      scope: 'vendor',
      target: vendorLabel(v),
      type: 'percentage',
      value: v.commissionRatePercent ?? DEFAULT_COMMISSION_RATE,
      appliesTo: countMap.get(v._id.toString()) || 0,
      updatedAt: v.updatedAt,
    })),
  ];

  res.json({ success: true, data: { items } });
}

async function updateVendorCommissionRate(req, res) {
  const { id } = req.params;
  const { value } = req.body;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return res.status(400).json({ success: false, message: 'Enter a commission rate between 0 and 100' });
  }

  const vendor = await Vendor.findByIdAndUpdate(id, { $set: { commissionRatePercent: rate } }, { new: true });
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  res.json({
    success: true,
    message: `${vendorLabel(vendor)} commission set to ${rate}%`,
    data: { id: vendor._id.toString(), scope: 'vendor', target: vendorLabel(vendor), type: 'percentage', value: rate, appliesTo: 0, updatedAt: vendor.updatedAt },
  });
}

module.exports = {
  getOverview,
  listTransactions,
  reconcileTransaction,
  bulkReconcileTransactions,
  listRefunds,
  processRefund,
  rejectRefund,
  listSettlements,
  getSettlementBatch,
  approveSettlement,
  rejectSettlement,
  retrySettlement,
  listVendorLedgers,
  getVendorStatement,
  listCommissionRules,
  updateVendorCommissionRate,
};
