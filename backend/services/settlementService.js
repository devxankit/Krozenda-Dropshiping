const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const Settlement = require('../Models/Settlement');
const Order = require('../Models/Order');
const { nextIds } = require('./accountingSequence');
const { fromPaise } = require('../utils/money');

// THE settlement generator. Both the Accounting module and the older Finance
// screens go through this one function, which is the whole point: two
// generators over one collection would each believe a line was unclaimed and
// pay it twice (task §15 Rule 5).
//
// What makes a delivered line settleable:
//
//   1. the line is DELIVERED, and
//   2. its sale has actually been posted to the ledger — which for a COD
//      order means the courier has remitted the cash (task §12), and
//   3. the hold window since delivery has elapsed, so a return raised inside
//      the window is netted off before the money leaves (task §7), and
//   4. no other live batch already owns it.
//
// The seller's net for a line is read back off the LEDGER, not recomputed —
// the commission that was actually charged, minus refunds already posted
// against it. That is what stops a settlement from disagreeing with the
// ledger it is supposed to be draining.

const HOLD_STATUS = 'ON_HOLD';

function vendorLabel(vendor) {
  return vendor?.business?.businessName || vendor?.name || 'Unknown seller';
}

/**
 * Every order line that is currently eligible, grouped by seller.
 * Returns a Map<vendorId, lines[]> with each line's ledger-derived figures.
 */
async function collectEligibleLines({ now = new Date(), vendorId = null } = {}) {
  const config = await AccountingConfig.resolve();
  const cutoff = new Date(now.getTime() - config.settlementHoldDays * 24 * 60 * 60 * 1000);

  // Lines already owned by a live batch. CANCELLED batches release theirs.
  const claimingBatches = await Settlement.find({ status: { $in: Settlement.CLAIMING_STATUSES } })
    .select('items.order items.product')
    .lean();
  const claimed = new Set();
  for (const batch of claimingBatches) {
    for (const item of batch.items) claimed.add(`${item.order}:${item.product}`);
  }

  // Everything the ledger knows per (order, product, vendor). Settling reads
  // these rather than recomputing from the order, so the batch and the ledger
  // can never disagree about what a line is worth.
  const ledger = await AccountingTransaction.aggregate([
    {
      $match: {
        vendor: { $ne: null },
        type: { $in: ['SALE', 'COMMISSION', 'PAYMENT_GATEWAY_FEE', 'SHIPPING_CHARGE', 'REFUND', 'REFUND_REVERSAL'] },
        ...(vendorId ? { vendor: vendorId } : {}),
      },
    },
    {
      $group: {
        _id: { order: '$order', product: '$product', vendor: '$vendor' },
        salePaise: { $sum: { $cond: [{ $eq: ['$type', 'SALE'] }, '$credit', 0] } },
        commissionPaise: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
        feesPaise: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT_GATEWAY_FEE'] }, '$debit', 0] } },
        shippingPaise: { $sum: { $cond: [{ $eq: ['$type', 'SHIPPING_CHARGE'] }, '$credit', 0] } },
        refundPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$debit', 0] } },
        commissionBackPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
      },
    },
    { $match: { salePaise: { $gt: 0 } } },
  ]);

  const orderIds = [...new Set(ledger.map((entry) => String(entry._id.order)))];
  const orders = await Order.find({ _id: { $in: orderIds } })
    .select('items.product items.status items.vendor items.name items.quantity deliveredAt paymentMethod codRemittedAt status')
    .lean();
  const orderById = new Map(orders.map((order) => [String(order._id), order]));

  const byVendor = new Map();

  for (const entry of ledger) {
    const order = orderById.get(String(entry._id.order));
    if (!order) continue;

    const key = `${entry._id.order}:${entry._id.product}`;
    if (claimed.has(key)) continue;

    const item = order.items.find(
      (candidate) =>
        String(candidate.product) === String(entry._id.product) &&
        String(candidate.vendor) === String(entry._id.vendor)
    );
    if (!item || item.status !== 'DELIVERED') continue;

    // Hold window. `deliveredAt` is order-level on this platform, so a line
    // with no delivery timestamp is not yet measurable and stays held.
    if (!order.deliveredAt || new Date(order.deliveredAt) > cutoff) continue;

    // COD that the courier has not remitted is money the platform does not
    // have. It must not be paid out (task §12).
    if (config.requireCodRemittanceBeforeSettlement && order.paymentMethod === 'COD' && !order.codRemittedAt) {
      continue;
    }

    const netPaise =
      entry.salePaise +
      entry.shippingPaise +
      entry.commissionBackPaise -
      entry.commissionPaise -
      entry.feesPaise -
      entry.refundPaise;

    // A line refunded down to nothing has no money left to settle. It is not
    // an error — it just does not belong in a batch.
    if (netPaise <= 0) continue;

    const vendorKey = String(entry._id.vendor);
    if (!byVendor.has(vendorKey)) byVendor.set(vendorKey, []);
    byVendor.get(vendorKey).push({
      order: entry._id.order,
      product: entry._id.product,
      name: item.name,
      quantity: item.quantity,
      deliveredAt: order.deliveredAt,
      paymentMethod: order.paymentMethod,
      salePaise: entry.salePaise + entry.shippingPaise,
      commissionPaise: entry.commissionPaise - entry.commissionBackPaise,
      feesPaise: entry.feesPaise,
      refundPaise: entry.refundPaise,
      netPaise,
    });
  }

  return byVendor;
}

/**
 * Draft a batch per seller from whatever is currently eligible.
 *
 * Safe to call repeatedly — a line already inside a live batch is excluded by
 * `claimed` above, so a second call in the same second produces nothing
 * rather than a duplicate batch (task §22 case 13).
 */
async function generateSettlements({ vendorId = null, generatedBy = null, now = new Date() } = {}) {
  const byVendor = await collectEligibleLines({ now, vendorId });
  if (byVendor.size === 0) return { created: [], count: 0 };

  const ids = await nextIds('settlement', byVendor.size);
  const batches = [];
  let index = 0;

  for (const [vendor, lines] of byVendor) {
    const grossPaise = lines.reduce((sum, line) => sum + line.salePaise, 0);
    const commissionPaise = lines.reduce((sum, line) => sum + line.commissionPaise, 0);
    const feesPaise = lines.reduce((sum, line) => sum + line.feesPaise, 0);
    const refundsPaise = lines.reduce((sum, line) => sum + line.refundPaise, 0);
    const netPayablePaise = lines.reduce((sum, line) => sum + line.netPaise, 0);

    const deliveries = lines.map((line) => new Date(line.deliveredAt).getTime());

    batches.push({
      settlementId: ids[index],
      vendor,
      items: lines.map((line) => ({
        order: line.order,
        product: line.product,
        name: line.name,
        quantity: line.quantity,
        grossAmount: fromPaise(line.salePaise),
        commissionAmount: fromPaise(line.commissionPaise),
        netAmount: fromPaise(line.netPaise),
        feeAmount: fromPaise(line.feesPaise),
        refundAmount: fromPaise(line.refundPaise),
        adjustmentAmount: 0,
        deliveredAt: line.deliveredAt,
        paymentMethod: line.paymentMethod,
      })),
      // Rupee mirrors, so the older Finance screens keep reading the same
      // batch correctly; both come off the same paise figures above.
      grossAmount: fromPaise(grossPaise),
      commissionAmount: fromPaise(commissionPaise),
      tdsAmount: 0,
      deductions: fromPaise(feesPaise + refundsPaise),
      netAmount: fromPaise(netPayablePaise),

      grossPaise,
      commissionPaise,
      feesPaise,
      refundsPaise,
      adjustmentsPaise: 0,
      netPayablePaise,

      periodStart: new Date(Math.min(...deliveries)),
      periodEnd: new Date(Math.max(...deliveries)),
      eligibleAt: now,
      status: 'ELIGIBLE',
      scheduledFor: now,
      generatedBy,
    });
    index += 1;
  }

  const created = await Settlement.insertMany(batches);
  return { created, count: created.length };
}

/**
 * Put a batch on hold, or take it off hold. A held batch keeps owning its
 * lines, so nothing else can pick them up while the question is being sorted
 * out.
 */
async function setSettlementHold({ settlementId, hold, reason = '' }) {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) return { ok: false, status: 404, message: 'Settlement not found' };

  if (hold) {
    if (!['ELIGIBLE', 'PENDING', 'AWAITING_APPROVAL'].includes(settlement.status)) {
      return { ok: false, status: 400, message: 'Only a settlement that has not been paid can be put on hold' };
    }
  } else if (settlement.status !== HOLD_STATUS) {
    return { ok: false, status: 400, message: 'This settlement is not on hold' };
  }

  const before = { status: settlement.status, holdReason: settlement.holdReason };
  const updated = await Settlement.findOneAndUpdate(
    { _id: settlementId, status: settlement.status },
    { $set: { status: hold ? HOLD_STATUS : 'ELIGIBLE', holdReason: hold ? String(reason || '').trim() : '' } },
    { new: true }
  );
  if (!updated) return { ok: false, status: 409, message: 'The settlement changed while you were deciding — reload and try again' };

  return { ok: true, settlement: updated, before };
}

/**
 * What each seller is owed right now, straight off the ledger, split by where
 * the money is in its lifecycle. Used by the Overview cards, the seller
 * ledger list and the settlement report — all three read this one function so
 * they cannot disagree.
 */
async function sellerBalances({ vendorId = null } = {}) {
  const match = { vendor: { $ne: null }, ...(vendorId ? { vendor: vendorId } : {}) };

  const [ledgerRows, settlementRows] = await Promise.all([
    AccountingTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$vendor',
          salesPaise: { $sum: { $cond: [{ $eq: ['$type', 'SALE'] }, '$credit', 0] } },
          shippingPaise: { $sum: { $cond: [{ $eq: ['$type', 'SHIPPING_CHARGE'] }, '$credit', 0] } },
          commissionPaise: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
          feesPaise: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT_GATEWAY_FEE'] }, '$debit', 0] } },
          refundsPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$debit', 0] } },
          commissionBackPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
          payoutsPaise: { $sum: { $cond: [{ $eq: ['$type', 'PAYOUT'] }, '$debit', 0] } },
          adjustmentCreditPaise: { $sum: { $cond: [{ $eq: ['$type', 'ADJUSTMENT'] }, '$credit', 0] } },
          adjustmentDebitPaise: { $sum: { $cond: [{ $eq: ['$type', 'ADJUSTMENT'] }, '$debit', 0] } },
          totalCredit: { $sum: '$credit' },
          totalDebit: { $sum: '$debit' },
          entries: { $sum: 1 },
          lastEntryAt: { $max: '$createdAt' },
        },
      },
    ]),
    Settlement.aggregate([
      { $match: { ...(vendorId ? { vendor: vendorId } : {}) } },
      {
        $group: {
          _id: '$vendor',
          onHoldPaise: { $sum: { $cond: [{ $eq: ['$status', HOLD_STATUS] }, '$netPayablePaise', 0] } },
          eligiblePaise: {
            $sum: {
              $cond: [{ $in: ['$status', ['ELIGIBLE', 'PENDING', 'AWAITING_APPROVAL']] }, '$netPayablePaise', 0],
            },
          },
          processingPaise: { $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, '$netPayablePaise', 0] } },
          paidPaise: { $sum: { $cond: [{ $in: ['$status', Settlement.PAID_STATUSES] }, '$netPayablePaise', 0] } },
          lastPaidAt: { $max: '$paidAt' },
        },
      },
    ]),
  ]);

  const settlementByVendor = new Map(settlementRows.map((entry) => [String(entry._id), entry]));

  return ledgerRows.map((entry) => {
    const batches = settlementByVendor.get(String(entry._id)) || {};
    // The seller's balance IS the ledger: credits minus debits, nothing else.
    const currentPayablePaise = entry.totalCredit - entry.totalDebit;
    return {
      vendor: entry._id,
      salesPaise: entry.salesPaise,
      shippingPaise: entry.shippingPaise,
      commissionPaise: entry.commissionPaise - entry.commissionBackPaise,
      feesPaise: entry.feesPaise,
      refundsPaise: entry.refundsPaise,
      adjustmentsPaise: entry.adjustmentCreditPaise - entry.adjustmentDebitPaise,
      paidPaise: entry.payoutsPaise,
      currentPayablePaise,
      onHoldPaise: batches.onHoldPaise || 0,
      settlementEligiblePaise: batches.eligiblePaise || 0,
      settlementProcessingPaise: batches.processingPaise || 0,
      settledPaise: batches.paidPaise || 0,
      lastPaidAt: batches.lastPaidAt || null,
      entries: entry.entries,
      lastEntryAt: entry.lastEntryAt,
    };
  });
}

module.exports = {
  collectEligibleLines,
  generateSettlements,
  setSettlementHold,
  sellerBalances,
  vendorLabel,
  HOLD_STATUS,
};
