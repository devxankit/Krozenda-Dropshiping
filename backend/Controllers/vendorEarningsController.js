const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingConfig = require('../Models/AccountingConfig');
const { sellerRatesFor } = require('../services/commissionResolver');
const { priceOrderCommissions } = require('../services/accountingPosting');
const { toPaise } = require('../utils/money');
const { readPagination, buildPagination } = require('../utils/pagination');

// What a seller is owed, read off the SAME ledger admin pays from.
//
// This used to recompute everything from Order rows with a flat
// `vendor.commissionRatePercent`, and reported `paidAmount: 0` unconditionally
// because it had no idea payouts existed. It did, and they do — Settlement,
// Payout and the commission resolver were all already live on the admin side.
// A seller seeing a different number from the one admin is paying is the worst
// kind of bug in this module, so both sides now read the same records.
//
// Three buckets, and the distinction between them is the whole point:
//
//   PAID       — a settlement batch that has actually been paid out.
//   IN BATCH   — delivered, claimed by a live batch, money not yet sent.
//   UNSETTLED  — delivered, not claimed by any batch. Read off the LEDGER's
//                frozen SALE / COMMISSION rows, exactly as the settlement
//                generator will read them. Only a line that is not on the
//                ledger yet (COD the courier has not remitted) is estimated,
//                and it is priced by the same function that will post it.
//
// Settlement carries both rupee fields (legacy) and integer-paise mirrors
// (accounting). Batches written before the Accounting module have only the
// former, so every read goes through paiseOf() rather than trusting either.

function paiseOf(settlement, paiseField, rupeeField) {
  const mirror = settlement[paiseField];
  if (typeof mirror === 'number' && mirror !== 0) return mirror;
  return toPaise(settlement[rupeeField] || 0);
}

const PAID = Settlement.PAID_STATUSES;
// Everything that owns its lines but has not paid them out yet.
const IN_FLIGHT = Settlement.CLAIMING_STATUSES.filter((s) => !PAID.includes(s));

// Every delivered line of this seller's that no live batch has claimed yet,
// with gross / commission / net as the settlement will see them.
//
// A line on the ledger is read back off its posted rows — the commission that
// was frozen when the order was paid, net of anything a refund has handed
// back — never re-resolved against today's rules. Re-resolving is how an
// admin editing a rule used to change the commission a seller saw on an order
// that had already been charged at the old rate.
//
// A line NOT on the ledger yet (a COD order whose cash the courier still
// holds) has no posted commission to read, so it is priced through
// priceOrderCommissions() — the function postOrderSale() will post it with,
// resolving rules as of the order date — and flagged `estimated`.
async function unsettledLines(vendorId, claimed) {
  const orders = await Order.find({ 'items.vendor': vendorId, 'items.status': 'DELIVERED' })
    .select('items couponCode discountAmount shippingFee subtotal total deliveredAt createdAt paymentMethod')
    .sort({ createdAt: -1 })
    .lean();
  if (orders.length === 0) return [];

  const ledger = await AccountingTransaction.aggregate([
    {
      $match: {
        vendor: vendorId,
        order: { $in: orders.map((order) => order._id) },
        type: { $in: ['SALE', 'COMMISSION', 'PAYMENT_GATEWAY_FEE', 'SHIPPING_CHARGE', 'REFUND', 'REFUND_REVERSAL'] },
      },
    },
    {
      $group: {
        _id: { order: '$order', product: '$product' },
        salePaise: { $sum: { $cond: [{ $eq: ['$type', 'SALE'] }, '$credit', 0] } },
        commissionPaise: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
        feesPaise: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT_GATEWAY_FEE'] }, '$debit', 0] } },
        shippingPaise: { $sum: { $cond: [{ $eq: ['$type', 'SHIPPING_CHARGE'] }, '$credit', 0] } },
        refundPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND'] }, '$debit', 0] } },
        commissionBackPaise: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
      },
    },
  ]);
  const posted = new Map(ledger.map((entry) => [`${entry._id.order}:${entry._id.product}`, entry]));

  const config = await AccountingConfig.resolve();
  const rows = [];

  for (const order of orders) {
    let estimate = null;

    for (const item of order.items) {
      if (String(item.vendor) !== String(vendorId) || item.status !== 'DELIVERED') continue;
      const key = `${order._id}:${item.product}`;
      if (claimed.has(key)) continue;

      const base = {
        order: order._id,
        product: item.product,
        name: item.name,
        quantity: item.quantity,
        deliveredAt: order.deliveredAt,
      };

      const entry = posted.get(key);
      if (entry && entry.salePaise > 0) {
        // Same arithmetic as settlementService.collectEligibleLines.
        const commissionPaise = entry.commissionPaise - entry.commissionBackPaise;
        const netPaise =
          entry.salePaise +
          entry.shippingPaise +
          entry.commissionBackPaise -
          entry.commissionPaise -
          entry.feesPaise -
          entry.refundPaise;
        rows.push({ ...base, grossPaise: entry.salePaise, commissionPaise, netPaise, estimated: false });
        continue;
      }

      // Priced once per order, however many of its lines are this seller's.
      if (!estimate) estimate = await priceOrderCommissions(order, { config });
      const line = estimate.sellerLines.find(
        (candidate) =>
          String(candidate.product) === String(item.product) && String(candidate.vendor) === String(vendorId)
      );
      if (!line) continue;
      rows.push({
        ...base,
        grossPaise: line.sellerGrossPaise,
        commissionPaise: line.commission.amountPaise,
        netPaise: line.sellerGrossPaise - line.commission.amountPaise,
        estimated: true,
      });
    }
  }

  return rows;
}

// Lines owned by a live batch, keyed the way a settlement item identifies one.
function claimedKeys(settlements) {
  const claimed = new Set();
  for (const s of settlements) {
    if (!Settlement.CLAIMING_STATUSES.includes(s.status)) continue;
    for (const item of s.items) claimed.add(`${item.order}:${item.product}`);
  }
  return claimed;
}

async function getMyEarningsSummary(req, res) {
  const vendorId = req.vendor._id;

  const [settlements, payouts, lineStates, rates] = await Promise.all([
    Settlement.find({ vendor: vendorId }).select(
      'status grossAmount commissionAmount netAmount grossPaise commissionPaise netPayablePaise items paidAt'
    ),
    Payout.find({ vendor: vendorId, status: 'COMPLETED' }).select('amount'),
    // Every line's status and value, for the in-transit and delivered counts.
    // No commission is worked out from these.
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      {
        $project: {
          status: '$items.status',
          lineTotal: { $multiply: ['$items.price', '$items.quantity'] },
        },
      },
    ]),
    sellerRatesFor([vendorId]),
  ]);

  let paidPaise = 0;
  let inBatchPaise = 0;
  let settledGrossPaise = 0;
  let settledCommissionPaise = 0;

  for (const s of settlements) {
    const net = paiseOf(s, 'netPayablePaise', 'netAmount');
    if (PAID.includes(s.status)) {
      paidPaise += net;
      settledGrossPaise += paiseOf(s, 'grossPaise', 'grossAmount');
      settledCommissionPaise += paiseOf(s, 'commissionPaise', 'commissionAmount');
    } else if (IN_FLIGHT.includes(s.status)) {
      inBatchPaise += net;
      settledGrossPaise += paiseOf(s, 'grossPaise', 'grossAmount');
      settledCommissionPaise += paiseOf(s, 'commissionPaise', 'commissionAmount');
    }
  }

  // Delivered but not yet in any batch.
  const unbatched = await unsettledLines(vendorId, claimedKeys(settlements));
  const unsettledGrossPaise = unbatched.reduce((sum, line) => sum + line.grossPaise, 0);
  const unsettledCommissionPaise = unbatched.reduce((sum, line) => sum + line.commissionPaise, 0);
  const unsettledNetPaise = unbatched.reduce((sum, line) => sum + line.netPaise, 0);

  // Value still moving: ordered, not cancelled, not delivered. Not earnings —
  // it is what MIGHT become earnings, and is labelled as such on screen.
  const inTransitPaise = lineStates
    .filter((l) => !['DELIVERED', 'CANCELLED'].includes(l.status))
    .reduce((sum, l) => sum + toPaise(l.lineTotal), 0);

  const grossPaise = settledGrossPaise + unsettledGrossPaise;
  const commissionPaise = settledCommissionPaise + unsettledCommissionPaise;
  const rate = rates.get(String(vendorId));

  res.json({
    success: true,
    data: {
      // The seller's headline rate (their SELLER rule, else the platform
      // default), shown for context. It is NOT necessarily the rate every
      // line was charged — a product rule outranks it — so the screen labels
      // it as the default.
      commissionRatePercent: rate.ratePercent,
      commissionRateType: rate.type,
      commissionRateValue: rate.value,
      totalSales: grossPaise,
      totalCommission: commissionPaise,
      netEarnings: grossPaise - commissionPaise,

      // Real ledger figures now, not a constant.
      paidAmount: paidPaise,
      // Owed but not yet transferred, split by how far along it is.
      pendingAmount: inBatchPaise + unsettledNetPaise,
      inBatchAmount: inBatchPaise,
      unsettledAmount: unsettledNetPaise,
      // Part of the unsettled figure that is not on the ledger yet (COD still
      // with the courier), so the screen can say it is an estimate.
      estimatedAmount: unbatched.filter((line) => line.estimated).reduce((sum, line) => sum + line.netPaise, 0),

      inTransitOrderValue: inTransitPaise,
      deliveredOrdersCount: lineStates.filter((l) => l.status === 'DELIVERED').length,
      // So the screen can link straight to the payout that paid them.
      completedPayoutsCount: payouts.length,
    },
  });
}

// The transaction list. Settlement items are the authoritative rows — they
// carry the commission that was ACTUALLY charged. Delivered lines not yet in a
// batch are appended below them, marked UNSETTLED, so a seller can see what is
// coming as well as what has been reckoned.
async function listMyEarningsEntries(req, res) {
  const vendorId = req.vendor._id;
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 25, maxLimit: 100 });

  const settlements = await Settlement.find({ vendor: vendorId })
    .select('settlementId status items createdAt paidAt netPayablePaise netAmount')
    .sort({ createdAt: -1 })
    .lean();

  const rows = [];

  for (const s of settlements) {
    if (!Settlement.CLAIMING_STATUSES.includes(s.status)) continue;
    const isPaid = PAID.includes(s.status);
    for (const item of s.items) {
      rows.push({
        id: `${s._id}-${item.order}-${item.product}`,
        orderId: item.order.toString(),
        productName: item.name,
        quantity: item.quantity,
        grossAmount: toPaise(item.grossAmount),
        commission: toPaise(item.commissionAmount),
        netAmount: toPaise(item.netAmount),
        deliveredAt: item.deliveredAt,
        // What a seller actually wants to know about a row.
        settlementId: s.settlementId || null,
        settlementStatus: s.status,
        state: isPaid ? 'PAID' : 'IN_BATCH',
        paidAt: isPaid ? s.paidAt : null,
        estimated: false,
      });
    }
  }

  for (const line of await unsettledLines(vendorId, claimedKeys(settlements))) {
    rows.push({
      id: `unsettled-${line.order}-${line.product}`,
      orderId: String(line.order),
      productName: line.name,
      quantity: line.quantity,
      grossAmount: line.grossPaise,
      commission: line.commissionPaise,
      netAmount: line.netPaise,
      deliveredAt: line.deliveredAt,
      settlementId: null,
      settlementStatus: null,
      state: 'UNSETTLED',
      paidAt: null,
      estimated: line.estimated,
    });
  }

  rows.sort((a, b) => new Date(b.deliveredAt || 0) - new Date(a.deliveredAt || 0));

  res.json({
    success: true,
    data: {
      items: rows.slice(skip, skip + limit),
      ...buildPagination({ page, limit, total: rows.length }),
    },
  });
}

// GET /vendor/earnings/payouts — the transfers themselves.
//
// Only ever this seller's own, and only the MASKED bank snapshot the payout
// carries. The full account number lives on the Vendor document and is never
// copied into a payout, let alone served (see the header on Models/Payout.js).
async function listMyPayouts(req, res) {
  const vendorId = req.vendor._id;
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 25, maxLimit: 100 });

  const [payouts, total] = await Promise.all([
    Payout.find({ vendor: vendorId })
      .select('payoutId amount status method bankAccountMasked bankName utr failureReason processedAt createdAt settlement attempt')
      .populate({ path: 'settlement', select: 'settlementId periodStart periodEnd' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payout.countDocuments({ vendor: vendorId }),
  ]);

  res.json({
    success: true,
    data: {
      items: payouts.map((p) => ({
        id: p._id.toString(),
        payoutId: p.payoutId,
        // Already integer paise on this model — no conversion.
        amount: p.amount,
        status: p.status,
        method: p.method,
        bankAccountMasked: p.bankAccountMasked || '',
        bankName: p.bankName || '',
        utr: p.utr || null,
        // A seller is entitled to know WHY a transfer to them failed.
        failureReason: p.failureReason || '',
        attempt: p.attempt,
        settlementId: p.settlement?.settlementId || null,
        periodStart: p.settlement?.periodStart || null,
        periodEnd: p.settlement?.periodEnd || null,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      })),
      ...buildPagination({ page, limit, total }),
    },
  });
}

module.exports = { getMyEarningsSummary, listMyEarningsEntries, listMyPayouts };
