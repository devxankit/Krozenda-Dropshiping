const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const AccountingConfig = require('../Models/AccountingConfig');
const { loadRules, resolveForLine } = require('../services/commissionResolver');
const { toPaise, fromPaise } = require('../utils/money');
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
//   UNSETTLED  — delivered, past nothing yet, not claimed by any batch. This
//                is the only figure still computed from orders, because by
//                definition no settlement row exists for it.
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

// The commission a line would actually be charged, resolved through the same
// hierarchy the ledger uses: a matching CommissionRule first, then the
// seller's own negotiated rate, then the platform default. The flat
// `vendor.commissionRatePercent` this file used before was only the second of
// those three, so any category or product rule an admin had written was
// invisible to the seller.
async function resolveCommission(vendorId, lines) {
  if (lines.length === 0) return { rules: [], config: null, rate: null };

  const config = (await AccountingConfig.findOne().lean()) || { defaultCommissionPercent: 10 };
  const rules = await loadRules({
    vendorIds: [vendorId],
    categoryIds: lines.map((l) => l.categoryId).filter(Boolean),
    productIds: lines.map((l) => l.productId).filter(Boolean),
  });
  return { rules, config };
}

async function getMyEarningsSummary(req, res) {
  const vendorId = req.vendor._id;

  const [settlements, payouts, deliveredLines] = await Promise.all([
    Settlement.find({ vendor: vendorId }).select(
      'status grossAmount commissionAmount netAmount grossPaise commissionPaise netPayablePaise items paidAt'
    ),
    Payout.find({ vendor: vendorId, status: 'COMPLETED' }).select('amount'),
    // Delivered lines, with the product's category, so unbatched earnings can
    // be priced through the commission resolver rather than a flat rate.
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productDoc',
        },
      },
      {
        $project: {
          status: '$items.status',
          product: '$items.product',
          category: { $arrayElemAt: ['$productDoc.category', 0] },
          lineTotal: { $multiply: ['$items.price', '$items.quantity'] },
        },
      },
    ]),
  ]);

  // Every order line already claimed by a batch, so it is not double-counted
  // as "unsettled" below. Keyed by order+product, which is what a settlement
  // item identifies.
  const claimed = new Set();
  for (const s of settlements) {
    if (!Settlement.CLAIMING_STATUSES.includes(s.status)) continue;
    for (const item of s.items) claimed.add(`${item.order}:${item.product}`);
  }

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
  const unbatched = deliveredLines.filter(
    (l) => l.status === 'DELIVERED' && !claimed.has(`${l._id}:${l.product}`)
  );

  const { rules, config } = await resolveCommission(
    vendorId,
    unbatched.map((l) => ({ categoryId: l.category, productId: l.product }))
  );

  let unsettledGrossPaise = 0;
  let unsettledCommissionPaise = 0;
  for (const line of unbatched) {
    const basePaise = toPaise(line.lineTotal);
    unsettledGrossPaise += basePaise;
    if (config) {
      const resolved = resolveForLine(
        {
          basePaise,
          vendorId,
          categoryId: line.category,
          productId: line.product,
          vendorRatePercent: req.vendor.commissionRatePercent ?? null,
        },
        rules,
        config
      );
      unsettledCommissionPaise += resolved.amountPaise;
    }
  }

  // Value still moving: ordered, not cancelled, not delivered. Not earnings —
  // it is what MIGHT become earnings, and is labelled as such on screen.
  const inTransitPaise = deliveredLines
    .filter((l) => !['DELIVERED', 'CANCELLED'].includes(l.status))
    .reduce((sum, l) => sum + toPaise(l.lineTotal), 0);

  const grossPaise = settledGrossPaise + unsettledGrossPaise;
  const commissionPaise = settledCommissionPaise + unsettledCommissionPaise;

  res.json({
    success: true,
    data: {
      // The seller's own negotiated rate, shown for context. It is NOT
      // necessarily the rate every line was charged — a category or product
      // rule outranks it — so the screen labels it as the default.
      commissionRatePercent: req.vendor.commissionRatePercent ?? config?.defaultCommissionPercent ?? 10,
      totalSales: grossPaise,
      totalCommission: commissionPaise,
      netEarnings: grossPaise - commissionPaise,

      // Real ledger figures now, not a constant.
      paidAmount: paidPaise,
      // Owed but not yet transferred, split by how far along it is.
      pendingAmount: inBatchPaise + (unsettledGrossPaise - unsettledCommissionPaise),
      inBatchAmount: inBatchPaise,
      unsettledAmount: unsettledGrossPaise - unsettledCommissionPaise,

      inTransitOrderValue: inTransitPaise,
      deliveredOrdersCount: deliveredLines.filter((l) => l.status === 'DELIVERED').length,
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
      });
    }
  }

  const claimed = new Set(rows.map((r) => `${r.orderId}:${r.productName}`));

  // Delivered, unbatched. Priced through the resolver so the commission shown
  // here matches what the batch will charge when it is generated.
  const orders = await Order.find({ 'items.vendor': vendorId, 'items.status': 'DELIVERED' })
    .select('items deliveredAt createdAt')
    .populate({ path: 'items.product', select: 'category' })
    .sort({ createdAt: -1 })
    .lean();

  const pendingLines = [];
  for (const order of orders) {
    for (const item of order.items) {
      if (item.vendor?.toString() !== vendorId.toString() || item.status !== 'DELIVERED') continue;
      if (claimed.has(`${order._id}:${item.name}`)) continue;
      pendingLines.push({ order, item });
    }
  }

  const { rules, config } = await resolveCommission(
    vendorId,
    pendingLines.map(({ item }) => ({
      categoryId: item.product?.category,
      productId: item.product?._id,
    }))
  );

  for (const { order, item } of pendingLines) {
    const basePaise = toPaise(item.price * item.quantity);
    const commissionPaise = config
      ? resolveForLine(
          {
            basePaise,
            vendorId,
            categoryId: item.product?.category,
            productId: item.product?._id,
            vendorRatePercent: req.vendor.commissionRatePercent ?? null,
          },
          rules,
          config
        ).amountPaise
      : 0;

    rows.push({
      id: `unsettled-${order._id}-${item.product?._id || item.name}`,
      orderId: order._id.toString(),
      productName: item.name,
      quantity: item.quantity,
      grossAmount: basePaise,
      commission: commissionPaise,
      netAmount: basePaise - commissionPaise,
      deliveredAt: order.deliveredAt,
      settlementId: null,
      settlementStatus: null,
      state: 'UNSETTLED',
      paidAt: null,
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
