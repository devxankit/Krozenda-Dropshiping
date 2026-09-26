const mongoose = require('mongoose');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Vendor = require('../Models/Vendor');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const settlementService = require('../services/settlementService');
const payoutService = require('../services/payoutService');
const refundService = require('../services/refundService');
const posting = require('../services/accountingPosting');
const { recordAudit } = require('../services/accountingAudit');
const { paged, resolveRange, vendorLabel, orderNumber } = require('./adminAccountingController');
const razorpaySettlementIntegration = require('../services/razorpaySettlementIntegration');

// Admin > Accounting > Settlements, Payouts and Refunds — the screens where
// money actually moves, and therefore the ones with the most guardrails.
//
// Nothing here recomputes what a seller is owed. Settlement generation and
// payout posting both go through services/, which read the ledger; these
// handlers validate the request, call the service, and write the audit row.

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

function serializeSettlement(settlement) {
  const vendor = settlement.vendor;
  return {
    id: String(settlement._id),
    settlementId: settlement.settlementId || `STL-${String(settlement._id).slice(-8).toUpperCase()}`,
    sellerId: String(vendor?._id || vendor),
    seller: vendorLabel(vendor),
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    lineCount: settlement.items?.length || 0,
    grossSales: settlement.grossPaise || 0,
    commission: settlement.commissionPaise || 0,
    fees: settlement.feesPaise || 0,
    refunds: settlement.refundsPaise || 0,
    adjustments: settlement.adjustmentsPaise || 0,
    netPayable: settlement.netPayablePaise || 0,
    status: settlement.status,
    holdReason: settlement.holdReason || '',
    utr: settlement.utr || null,
    payoutRef: settlement.payout ? String(settlement.payout) : null,
    createdAt: settlement.createdAt,
    eligibleAt: settlement.eligibleAt,
    paidAt: settlement.paidAt,
  };
}

async function listSettlements(req, res) {
  const { tab, status, sellerId, search, page, rowsPerPage } = req.query;
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  // Keep the ledger current, then draft anything newly eligible — the same
  // opportunistic pattern the older Finance screen already used, now with a
  // single generator behind it so a line cannot be claimed twice.
  await posting.reconcileLedger();
  await settlementService.generateSettlements({ generatedBy: req.admin?._id || null });

  const filter = {};
  if (status && Settlement.STATUSES.includes(status)) filter.status = status;
  if (sellerId) {
    if (!mongoose.isValidObjectId(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    filter.vendor = new mongoose.Types.ObjectId(sellerId);
  }
  if (range) filter.createdAt = { $gte: range.from, $lte: range.to };

  const TAB_STATUSES = {
    pending: ['PENDING', 'AWAITING_APPROVAL'],
    eligible: ['ELIGIBLE'],
    processing: ['PROCESSING'],
    completed: ['COMPLETED', 'SETTLED'],
    on_hold: ['ON_HOLD'],
    failed: ['FAILED'],
  };
  if (tab && TAB_STATUSES[tab] && !filter.status) filter.status = { $in: TAB_STATUSES[tab] };

  const [rows, counts] = await Promise.all([
    Settlement.find(filter).populate('vendor', 'name business.businessName').sort({ createdAt: -1 }).lean(),
    Settlement.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  let items = rows.map(serializeSettlement);

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (entry) =>
        entry.settlementId.toLowerCase().includes(term) ||
        entry.seller.toLowerCase().includes(term) ||
        (entry.utr || '').toLowerCase().includes(term)
    );
  }

  const byStatus = Object.fromEntries(counts.map((entry) => [entry._id, entry.count]));
  const countFor = (statuses) => statuses.reduce((sum, key) => sum + (byStatus[key] || 0), 0);

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, {
      all: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      pending: countFor(TAB_STATUSES.pending),
      eligible: countFor(TAB_STATUSES.eligible),
      processing: countFor(TAB_STATUSES.processing),
      completed: countFor(TAB_STATUSES.completed),
      on_hold: countFor(TAB_STATUSES.on_hold),
      failed: countFor(TAB_STATUSES.failed),
    }),
  });
}

async function getSettlement(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid settlement id' });
  }

  const settlement = await Settlement.findById(id)
    .populate('vendor', 'name business.businessName business.gstin bank')
    .lean();
  if (!settlement) {
    return res.status(404).json({ success: false, message: 'Settlement not found' });
  }

  const config = await AccountingConfig.resolve();
  const holdMs = config.settlementHoldDays * 24 * 60 * 60 * 1000;
  const bank = settlement.vendor?.bank || {};

  const payouts = await Payout.find({ settlement: settlement._id }).sort({ attempt: -1 }).lean();
  const { toPaise } = require('../utils/money');

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      ...serializeSettlement(settlement),
      gstin: settlement.vendor?.business?.gstin || '',
      // Masked, always. The full account number never leaves the Vendor
      // document (task §8, §17).
      fundAccount: {
        bankName: bank.bankName || '',
        accountMasked: payoutService.maskAccount(bank.accountNumber),
        ifsc: bank.ifsc || '',
        accountHolderName: bank.accountHolderName || '',
        onFile: Boolean(bank.accountNumber && bank.ifsc),
      },
      lines: (settlement.items || []).map((item, index) => ({
        sn: index + 1,
        orderId: String(item.order),
        orderNumber: orderNumber(item.order),
        productName: item.name,
        quantity: item.quantity,
        paymentMethod: item.paymentMethod || null,
        deliveredAt: item.deliveredAt,
        eligibleAt: new Date(new Date(item.deliveredAt).getTime() + holdMs),
        gross: toPaise(item.grossAmount),
        commission: toPaise(item.commissionAmount),
        fees: toPaise(item.feeAmount || 0),
        refunds: toPaise(item.refundAmount || 0),
        net: toPaise(item.netAmount),
      })),
      payouts: payouts.map((payout) => payoutService.serializePayout(payout)),
    },
  });
}

// POST /admin/accounting/settlements/generate
async function generateSettlements(req, res) {
  const { sellerId } = req.body;
  if (sellerId && !mongoose.isValidObjectId(sellerId)) {
    return res.status(400).json({ success: false, message: 'Invalid seller id' });
  }

  await posting.reconcileLedger();

  const result = await settlementService.generateSettlements({
    vendorId: sellerId ? new mongoose.Types.ObjectId(sellerId) : null,
    generatedBy: req.admin?._id || null,
  });

  for (const settlement of result.created) {
    await recordAudit({
      action: 'SETTLEMENT_GENERATED',
      req,
      entityType: 'Settlement',
      entityId: settlement._id,
      after: {
        settlementId: settlement.settlementId,
        seller: String(settlement.vendor),
        netPayablePaise: settlement.netPayablePaise,
        lines: settlement.items.length,
      },
    });
  }

  res.json({
    success: true,
    message: result.count === 0 ? 'Nothing is eligible for settlement right now' : `${result.count} settlement(s) generated`,
    data: { generated: result.count, items: result.created.map((s) => serializeSettlement(s.toObject ? s.toObject() : s)) },
  });
}

// POST /admin/accounting/settlements/:id/hold  |  /release
async function setSettlementHold(req, res, hold) {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid settlement id' });
  }
  if (hold && !String(reason || '').trim()) {
    return res.status(400).json({ success: false, message: 'Say why this settlement is being held' });
  }

  const result = await settlementService.setSettlementHold({ settlementId: id, hold, reason });
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  await recordAudit({
    action: hold ? 'SETTLEMENT_HELD' : 'SETTLEMENT_RELEASED',
    req,
    entityType: 'Settlement',
    entityId: id,
    before: result.before,
    after: { status: result.settlement.status, holdReason: result.settlement.holdReason },
    reason: String(reason || '').trim(),
  });

  const populated = await Settlement.findById(id).populate('vendor', 'name business.businessName').lean();
  res.json({
    success: true,
    message: hold ? 'Settlement put on hold' : 'Settlement released',
    data: serializeSettlement(populated),
  });
}

const holdSettlement = (req, res) => setSettlementHold(req, res, true);
const releaseSettlement = (req, res) => setSettlementHold(req, res, false);

// POST /admin/accounting/settlements/:id/release-transfer
//
// The manual counterpart to settlementReleaseJob.js's cron: for MANUAL
// settlement mode (or an explicit forced retry in AUTO mode), an admin can
// pay a settlement out right now instead of waiting for the job. Nothing
// here recomputes an amount — it only drives the already-computed Settlement/
// Payout through the same server-side flow the automation uses:
//   1. no Razorpay Route payout yet          -> create+hold (forced),
//      then immediately release it via the same safety-checked path the
//      cron job uses (razorpaySettlementIntegration.releaseSinglePayout).
//   2. a payout already PROCESSING            -> release it via that same
//      path directly.
//   3. a payout already RELEASED/COMPLETED    -> no-op, report current state.
async function releaseSettlementTransfer(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid settlement id' });
  }

  const settlement = await Settlement.findById(id).lean();
  if (!settlement) {
    return res.status(404).json({ success: false, message: 'Settlement not found' });
  }

  const respondWithPayout = async (payout, message) => {
    const populated = await Payout.findById(payout._id)
      .populate('vendor', 'name business.businessName')
      .populate('settlement', 'settlementId')
      .lean();
    res.json({
      success: true,
      message,
      data: payoutService.serializePayout(populated, { vendor: vendorLabel(populated.vendor) }),
    });
  };

  // Latest Razorpay Route attempt on this settlement, if any.
  const existing = await Payout.findOne({ settlement: settlement._id, method: 'RAZORPAY_ROUTE' })
    .sort({ attempt: -1 })
    .lean();

  if (existing && ['RELEASED', 'COMPLETED'].includes(existing.status)) {
    return respondWithPayout(existing, `This settlement's Razorpay Route payout is already ${existing.status.toLowerCase()} — nothing to release`);
  }

  let payoutToRelease = null;

  if (existing && existing.status === 'PROCESSING' && existing.razorpayTransferId) {
    payoutToRelease = existing;
  } else {
    // No Razorpay Route payout on hold yet — create (and hold) one now.
    // `force: true` bypasses only the AUTO-mode gate; every safety check
    // still applies.
    const initiated = await razorpaySettlementIntegration.initiateRazorpayTransferForSettlement(id, { force: true });

    if (!initiated.ok) {
      return res.status(400).json({ success: false, message: initiated.message || 'Could not create the Razorpay Route transfer' });
    }
    if (initiated.outcome !== 'TRANSFER_CREATED') {
      // ALREADY_EXISTS / HELD / SKIPPED_MANUAL_MODE / NOT_TRANSFERABLE — none
      // of these leave us with a freshly-held payout to release.
      return res.status(200).json({
        success: true,
        message: initiated.message || `Settlement release not actionable right now (${initiated.outcome})`,
        data: { settlementId: String(settlement._id), outcome: initiated.outcome, reason: initiated.reason || null, detail: initiated.detail || null },
      });
    }
    if (initiated.payout?.status === 'RELEASED') {
      // A direct transfer (RAZORPAY_ROUTE_TRANSFER_MODE=direct) has no hold
      // to lift — it is already on its way.
      await recordAudit({
        action: 'SETTLEMENT_TRANSFER_RELEASED',
        req,
        entityType: 'Payout',
        entityId: initiated.payout._id,
        before: { status: null },
        after: { status: 'RELEASED' },
      });
      return respondWithPayout(initiated.payout, 'Settlement released — Razorpay will settle the transfer to the seller');
    }
    payoutToRelease = initiated.payout;
  }

  const withSettlement = await Payout.findById(payoutToRelease._id)
    .populate({ path: 'settlement' })
    .lean();

  const released = await razorpaySettlementIntegration.releaseSinglePayout(withSettlement);

  await recordAudit({
    action: released.ok ? 'SETTLEMENT_TRANSFER_RELEASED' : 'SETTLEMENT_TRANSFER_RELEASE_FAILED',
    req,
    entityType: 'Payout',
    entityId: withSettlement._id,
    before: { status: withSettlement.status },
    after: { status: released.payout?.status || withSettlement.status },
    reason: released.ok ? '' : (released.message || released.reason || ''),
  });

  if (!released.ok) {
    return res.status(409).json({
      success: false,
      message: released.message || `Could not release this payout (${released.outcome})`,
    });
  }

  return respondWithPayout(released.payout, 'Settlement released — Razorpay will settle the transfer to the seller');
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

async function listPayouts(req, res) {
  const { tab, status, sellerId, search, page, rowsPerPage } = req.query;
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  const filter = {};
  if (status && Payout.STATUSES.includes(status)) filter.status = status;
  if (tab && tab !== 'all' && Payout.STATUSES.includes(String(tab).toUpperCase()) && !filter.status) {
    filter.status = String(tab).toUpperCase();
  }
  if (sellerId) {
    if (!mongoose.isValidObjectId(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    filter.vendor = new mongoose.Types.ObjectId(sellerId);
  }
  if (range) filter.createdAt = { $gte: range.from, $lte: range.to };

  const [rows, counts] = await Promise.all([
    Payout.find(filter)
      .populate('vendor', 'name business.businessName')
      .populate('settlement', 'settlementId')
      .sort({ createdAt: -1 })
      .lean(),
    Payout.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  let items = rows.map((payout) =>
    payoutService.serializePayout(payout, { vendor: vendorLabel(payout.vendor) })
  );

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (entry) =>
        entry.payoutId.toLowerCase().includes(term) ||
        String(entry.settlementId).toLowerCase().includes(term) ||
        entry.seller.toLowerCase().includes(term) ||
        (entry.utr || '').toLowerCase().includes(term)
    );
  }

  const byStatus = Object.fromEntries(counts.map((entry) => [entry._id, entry.count]));

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, {
      all: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      PENDING: byStatus.PENDING || 0,
      PROCESSING: byStatus.PROCESSING || 0,
      COMPLETED: byStatus.COMPLETED || 0,
      FAILED: byStatus.FAILED || 0,
      CANCELLED: byStatus.CANCELLED || 0,
    }),
  });
}

async function getPayout(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid payout id' });
  }

  const payout = await Payout.findById(id)
    .populate('vendor', 'name business.businessName')
    .populate('settlement', 'settlementId netPayablePaise periodStart periodEnd status')
    .lean();
  if (!payout) {
    return res.status(404).json({ success: false, message: 'Payout not found' });
  }

  const ledgerRow = await AccountingTransaction.findOne({ payout: payout._id }).lean();

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      ...payoutService.serializePayout(payout, {
        vendor: vendorLabel(payout.vendor),
        settlement: payout.settlement?.settlementId,
      }),
      settlement: payout.settlement
        ? {
            id: String(payout.settlement._id),
            settlementId: payout.settlement.settlementId,
            netPayable: payout.settlement.netPayablePaise,
            periodStart: payout.settlement.periodStart,
            periodEnd: payout.settlement.periodEnd,
            status: payout.settlement.status,
          }
        : null,
      ledgerTransactionId: ledgerRow?.transactionId || null,
      auditHistory: (payout.auditHistory || []).map((entry) => ({
        action: entry.action,
        from: entry.from,
        to: entry.to,
        by: entry.byName || 'System',
        reason: entry.reason || '',
        at: entry.at,
      })),
    },
  });
}

// POST /admin/accounting/payouts
//
// For method RAZORPAY_ROUTE this is also how a FAILED Route payout gets
// retried: payoutService.createPayout alone only inserts a Payout row, it
// never talks to Razorpay, so a plain retry through it would leave a Route
// payout stuck with no transfer. Instead the settlement is re-run through
// initiateRazorpayTransferForSettlement (force: true, so a MANUAL-mode
// settlement can still be retried explicitly) — the same creator the
// automation uses — which itself calls payoutService.createPayout internally.
async function createPayout(req, res) {
  const { settlementId, method, notes } = req.body;

  if ((method || '').toUpperCase() === 'RAZORPAY_ROUTE') {
    if (!mongoose.isValidObjectId(settlementId)) {
      return res.status(400).json({ success: false, message: 'Invalid settlement id' });
    }

    const initiated = await razorpaySettlementIntegration.initiateRazorpayTransferForSettlement(settlementId, { force: true });
    if (!initiated.ok) {
      return res.status(400).json({ success: false, message: initiated.message || 'Could not create the Razorpay Route transfer' });
    }

    if (initiated.outcome !== 'TRANSFER_CREATED' && initiated.outcome !== 'ALREADY_EXISTS') {
      return res.status(200).json({
        success: true,
        message: initiated.message || `Not actionable right now (${initiated.outcome})`,
        data: { settlementId, outcome: initiated.outcome, reason: initiated.reason || null, detail: initiated.detail || null },
      });
    }

    await recordAudit({
      action: 'PAYOUT_INITIATED',
      req,
      entityType: 'Payout',
      entityId: initiated.payout._id,
      after: {
        payoutId: initiated.payout.payoutId,
        settlement: String(settlementId),
        method: 'RAZORPAY_ROUTE',
        outcome: initiated.outcome,
      },
      reason: String(notes || '').trim(),
    });

    return res.status(initiated.outcome === 'TRANSFER_CREATED' ? 201 : 200).json({
      success: true,
      message: initiated.outcome === 'TRANSFER_CREATED' ? 'Razorpay Route transfer created and held' : initiated.message,
      data: payoutService.serializePayout(initiated.payout),
    });
  }

  const result = await payoutService.createPayout({
    settlementId,
    admin: req.admin,
    method: method || 'BANK_TRANSFER',
    notes,
  });

  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  if (result.duplicate) {
    // Idempotent: the caller gets the payout that already exists rather than
    // a second one or an error (task §15 Rule 4).
    return res.status(200).json({
      success: true,
      message: result.message,
      data: payoutService.serializePayout(result.payout),
    });
  }

  await recordAudit({
    action: 'PAYOUT_INITIATED',
    req,
    entityType: 'Payout',
    entityId: result.payout._id,
    after: {
      payoutId: result.payout.payoutId,
      settlement: String(result.payout.settlement),
      seller: String(result.payout.vendor),
      amountPaise: result.payout.amount,
      attempt: result.payout.attempt,
    },
    reason: String(notes || '').trim(),
  });

  res.status(201).json({
    success: true,
    message: 'Payout initiated',
    data: payoutService.serializePayout(result.payout.toObject()),
  });
}

// PATCH /admin/accounting/payouts/:id/status
async function updatePayoutStatus(req, res) {
  const { id } = req.params;
  const { status, utr, providerReference, failureReason } = req.body;

  const result = await payoutService.settlePayoutStatus({
    payoutId: id,
    status: String(status || '').toUpperCase(),
    utr,
    providerReference,
    failureReason,
    admin: req.admin,
  });

  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  const ACTION = {
    COMPLETED: 'PAYOUT_COMPLETED',
    FAILED: 'PAYOUT_FAILED',
    CANCELLED: 'PAYOUT_CANCELLED',
    PROCESSING: 'PAYOUT_INITIATED',
  };

  await recordAudit({
    action: ACTION[result.payout.status] || 'PAYOUT_INITIATED',
    req,
    entityType: 'Payout',
    entityId: result.payout._id,
    before: { status: result.before.status },
    after: { status: result.payout.status, utr: result.payout.utr },
    reason: String(failureReason || '').trim(),
  });

  res.json({
    success: true,
    message: `Payout marked ${result.payout.status.toLowerCase()}`,
    data: payoutService.serializePayout(result.payout.toObject()),
  });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

async function listRefunds(req, res) {
  const { tab, status, sellerId, search, page, rowsPerPage } = req.query;
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  await posting.reconcileLedger();

  const all = await refundService.listAllRefunds({ range });

  let items = all;
  if (status) items = items.filter((entry) => entry.status === status);
  if (sellerId) {
    if (!mongoose.isValidObjectId(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    items = items.filter((entry) => entry.sellerId === String(sellerId));
  }

  const TAB_STATUSES = {
    open: ['REQUESTED', 'APPROVED', 'PROCESSING'],
    completed: ['COMPLETED'],
    cancelled: ['CANCELLED', 'FAILED'],
  };
  if (tab && TAB_STATUSES[tab]) items = items.filter((entry) => TAB_STATUSES[tab].includes(entry.status));
  else if (tab === 'partial') items = items.filter((entry) => entry.refundType === 'PARTIAL');

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (entry) =>
        entry.refundId.toLowerCase().includes(term) ||
        entry.orderNumber.toLowerCase().includes(term) ||
        entry.customer.toLowerCase().includes(term) ||
        entry.seller.toLowerCase().includes(term)
    );
  }

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, {
      all: all.length,
      open: all.filter((entry) => TAB_STATUSES.open.includes(entry.status)).length,
      partial: all.filter((entry) => entry.refundType === 'PARTIAL').length,
      completed: all.filter((entry) => entry.status === 'COMPLETED').length,
      cancelled: all.filter((entry) => TAB_STATUSES.cancelled.includes(entry.status)).length,
    }),
  });
}

async function getRefund(req, res) {
  const { id } = req.params;

  const all = await refundService.listAllRefunds();
  const refund = all.find((entry) => entry.id === id || entry.rawId === id);
  if (!refund) {
    return res.status(404).json({ success: false, message: 'Refund not found' });
  }

  // The ledger rows this refund produced — the proof that the reversal
  // actually happened, and what it did to the seller's balance.
  const ledger = await AccountingTransaction.find({
    order: refund.orderId,
    type: { $in: ['REFUND', 'REFUND_REVERSAL'] },
    ...(refund.kind === 'RETURN' ? { returnRequest: refund.rawId } : {}),
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      ...refund,
      ledgerEntries: ledger.map((entry) => ({
        id: String(entry._id),
        transactionId: entry.transactionId,
        type: entry.type,
        direction: entry.direction,
        amount: entry.amount,
        description: entry.description,
        createdAt: entry.createdAt,
      })),
    },
  });
}

// POST /admin/accounting/refunds/:id/approve  |  /reject
async function decideRefund(req, res, decision) {
  const { id } = req.params;
  const { reason } = req.body;

  // Only a per-item return request is still open to a decision. A refund that
  // came from a cancellation was resolved the moment the order was cancelled.
  const rawId = id.startsWith('return:') ? id.slice('return:'.length) : id;
  if (id.startsWith('order:')) {
    return res.status(400).json({ success: false, message: 'This refund was already settled when the order was cancelled' });
  }

  const result = await refundService.decideReturnRefund({
    requestId: rawId,
    decision,
    reason,
    admin: req.admin,
  });

  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  await recordAudit({
    action: decision === 'APPROVED' ? 'REFUND_APPROVED' : 'REFUND_CANCELLED',
    req,
    entityType: 'ReturnRequest',
    entityId: rawId,
    before: { status: 'PENDING' },
    after: { status: result.request.status, refundAmount: result.request.refundAmount },
    reason: String(reason || '').trim(),
  });

  const all = await refundService.listAllRefunds();
  const refreshed = all.find((entry) => entry.rawId === rawId);

  res.json({
    success: true,
    message: decision === 'APPROVED' ? 'Refund approved and posted to the ledger' : 'Refund declined',
    data: refreshed,
  });
}

const approveRefund = (req, res) => decideRefund(req, res, 'APPROVED');
const rejectRefund = (req, res) => decideRefund(req, res, 'REJECTED');

module.exports = {
  serializeSettlement,
  listSettlements,
  getSettlement,
  generateSettlements,
  holdSettlement,
  releaseSettlement,
  releaseSettlementTransfer,
  listPayouts,
  getPayout,
  createPayout,
  updatePayoutStatus,
  listRefunds,
  getRefund,
  approveRefund,
  rejectRefund,
};
