const mongoose = require('mongoose');
const AccountingTransaction = require('../Models/AccountingTransaction');
const AccountingAuditLog = require('../Models/AccountingAuditLog');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const posting = require('../services/accountingPosting');
const settlementService = require('../services/settlementService');
const refundService = require('../services/refundService');
const { toPaise } = require('../utils/money');
const { paged, resolveRange, vendorLabel, orderNumber } = require('./adminAccountingController');

// Admin > Accounting > Reports (task §13).
//
// Every report is an aggregation over the SAME ledger the Overview and the
// seller pages read, which is what makes "reports match transaction/ledger
// totals" true by construction rather than by luck. None of them fabricate a
// row: an empty window returns an empty `rows` array and zeroed totals, and
// the screen says so.
//
// Each report returns { columns, rows, totals } — one shape, so the frontend
// has one report renderer and one CSV exporter rather than five of each.

function column(key, header, format = 'text') {
  return { key, header, format };
}

function sellerFilterClause(sellerId, field = 'vendor') {
  if (!sellerId) return {};
  return { [field]: new mongoose.Types.ObjectId(sellerId) };
}

// ---------------------------------------------------------------------------
// Sales report — by day
// ---------------------------------------------------------------------------

async function salesReport({ range, sellerId }) {
  // Gross sales, discounts and order counts are properties of the ORDER, so
  // they come off orders; refunds come off the ledger, where they actually
  // live. Both are constrained to the same window.
  const orderMatch = {
    $or: [
      { paymentStatus: { $in: ['PAID', 'REFUNDED'] } },
      { paymentMethod: 'COD', codRemittedAt: { $ne: null } },
    ],
    ...(range ? { createdAt: { $gte: range.from, $lte: range.to } } : {}),
    ...(sellerId ? { 'items.vendor': new mongoose.Types.ObjectId(sellerId) } : {}),
  };

  const [orderRows, refundRows] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          grossSales: { $sum: '$subtotal' },
          discounts: { $sum: '$discountAmount' },
          shipping: { $sum: '$shippingFee' },
          netSales: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    AccountingTransaction.aggregate([
      {
        $match: {
          type: 'REFUND',
          ...(range ? { createdAt: { $gte: range.from, $lte: range.to } } : {}),
          ...sellerFilterClause(sellerId),
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          refunds: { $sum: '$debit' },
        },
      },
    ]),
  ]);

  const refundByDay = new Map(refundRows.map((entry) => [entry._id, entry.refunds]));

  const rows = orderRows.map((entry) => {
    const refunds = refundByDay.get(entry._id) || 0;
    return {
      date: entry._id,
      orders: entry.orders,
      grossSales: toPaise(entry.grossSales),
      discounts: toPaise(entry.discounts),
      refunds,
      // Same definition as the Overview's Sales summary: gross less discounts
      // less refunds, with shipping excluded (it is not revenue from goods).
      netSales: toPaise(entry.grossSales) - toPaise(entry.discounts) - refunds,
    };
  });

  // Refund-only days still belong in the report — money moved.
  for (const [date, refunds] of refundByDay) {
    if (rows.some((row) => row.date === date)) continue;
    rows.push({ date, orders: 0, grossSales: 0, discounts: 0, refunds, netSales: -refunds });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);

  return {
    columns: [
      column('date', 'Date', 'date'),
      column('orders', 'Orders', 'count'),
      column('grossSales', 'Gross Sales', 'money'),
      column('discounts', 'Discounts', 'money'),
      column('refunds', 'Refunds', 'money'),
      column('netSales', 'Net Sales', 'money'),
    ],
    rows,
    totals: {
      orders: sum('orders'),
      grossSales: sum('grossSales'),
      discounts: sum('discounts'),
      refunds: sum('refunds'),
      netSales: sum('netSales'),
    },
  };
}

// ---------------------------------------------------------------------------
// Commission report — by seller
// ---------------------------------------------------------------------------

async function commissionReport({ range, sellerId }) {
  const match = {
    vendor: { $ne: null },
    ...(range ? { createdAt: { $gte: range.from, $lte: range.to } } : {}),
    ...sellerFilterClause(sellerId),
  };

  const rows = await AccountingTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$vendor',
        grossSales: { $sum: { $cond: [{ $eq: ['$type', 'SALE'] }, '$credit', 0] } },
        commission: { $sum: { $cond: [{ $eq: ['$type', 'COMMISSION'] }, '$debit', 0] } },
        commissionReversed: { $sum: { $cond: [{ $eq: ['$type', 'REFUND_REVERSAL'] }, '$credit', 0] } },
        orders: { $addToSet: { $cond: [{ $eq: ['$type', 'SALE'] }, '$order', '$$REMOVE'] } },
      },
    },
  ]);

  const vendors = await Vendor.find({ _id: { $in: rows.map((row) => row._id) } })
    .select('name business.businessName')
    .lean();
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  const mapped = rows
    .map((row) => {
      const commission = row.commission - row.commissionReversed;
      return {
        sellerId: String(row._id),
        seller: vendorLabel(vendorById.get(String(row._id))),
        orders: row.orders.length,
        grossSales: row.grossSales,
        // The EFFECTIVE rate actually charged over the window, derived from
        // the two figures beside it — not a rule's nominal rate, which may
        // have changed or may not have applied to every line.
        commissionRate: row.grossSales > 0 ? Number(((commission / row.grossSales) * 100).toFixed(2)) : 0,
        commissionAmount: commission,
      };
    })
    .filter((row) => row.orders > 0 || row.commissionAmount !== 0)
    .sort((a, b) => b.commissionAmount - a.commissionAmount);

  return {
    columns: [
      column('seller', 'Seller'),
      column('orders', 'Orders', 'count'),
      column('grossSales', 'Gross Sales', 'money'),
      column('commissionRate', 'Commission Rate', 'percent'),
      column('commissionAmount', 'Commission Amount', 'money'),
    ],
    rows: mapped,
    totals: {
      orders: mapped.reduce((sum, row) => sum + row.orders, 0),
      grossSales: mapped.reduce((sum, row) => sum + row.grossSales, 0),
      commissionAmount: mapped.reduce((sum, row) => sum + row.commissionAmount, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Seller settlement report
// ---------------------------------------------------------------------------

async function settlementReport({ sellerId }) {
  const balances = await settlementService.sellerBalances({
    vendorId: sellerId ? new mongoose.Types.ObjectId(sellerId) : null,
  });

  const vendors = await Vendor.find({ _id: { $in: balances.map((entry) => entry.vendor) } })
    .select('name business.businessName')
    .lean();
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  const rows = balances
    .map((entry) => ({
      sellerId: String(entry.vendor),
      seller: vendorLabel(vendorById.get(String(entry.vendor))),
      grossSales: entry.salesPaise + entry.shippingPaise,
      commission: entry.commissionPaise,
      fees: entry.feesPaise,
      refunds: entry.refundsPaise,
      adjustments: entry.adjustmentsPaise,
      netPayable: entry.currentPayablePaise + entry.paidPaise,
      paid: entry.paidPaise,
      pending: entry.currentPayablePaise,
    }))
    .sort((a, b) => b.pending - a.pending);

  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);

  return {
    columns: [
      column('seller', 'Seller'),
      column('grossSales', 'Gross Sales', 'money'),
      column('commission', 'Commission', 'money'),
      column('fees', 'Fees', 'money'),
      column('refunds', 'Refunds', 'money'),
      column('adjustments', 'Adjustments', 'money'),
      column('netPayable', 'Net Payable', 'money'),
      column('paid', 'Paid', 'money'),
      column('pending', 'Pending', 'money'),
    ],
    rows,
    totals: {
      grossSales: sum('grossSales'),
      commission: sum('commission'),
      fees: sum('fees'),
      refunds: sum('refunds'),
      adjustments: sum('adjustments'),
      netPayable: sum('netPayable'),
      paid: sum('paid'),
      pending: sum('pending'),
    },
  };
}

// ---------------------------------------------------------------------------
// Payout report
// ---------------------------------------------------------------------------

async function payoutReport({ range, sellerId, status }) {
  const filter = {
    ...(range ? { createdAt: { $gte: range.from, $lte: range.to } } : {}),
    ...sellerFilterClause(sellerId),
    ...(status && Payout.STATUSES.includes(status) ? { status } : {}),
  };

  const payouts = await Payout.find(filter)
    .populate('vendor', 'name business.businessName')
    .populate('settlement', 'settlementId')
    .sort({ createdAt: -1 })
    .lean();

  const rows = payouts.map((payout) => ({
    sellerId: String(payout.vendor?._id || payout.vendor),
    seller: vendorLabel(payout.vendor),
    settlement: payout.settlement?.settlementId || String(payout.settlement),
    payoutId: payout.payoutId,
    amount: payout.amount,
    utr: payout.utr || '—',
    status: payout.status,
    date: payout.processedAt || payout.createdAt,
  }));

  return {
    columns: [
      column('seller', 'Seller'),
      column('settlement', 'Settlement'),
      column('payoutId', 'Payout'),
      column('amount', 'Amount', 'money'),
      column('utr', 'UTR'),
      column('status', 'Status', 'status'),
      column('date', 'Date', 'datetime'),
    ],
    rows,
    totals: {
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      // Only money that actually left counts as paid.
      completed: rows.filter((row) => row.status === 'COMPLETED').reduce((sum, row) => sum + row.amount, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Refund report
// ---------------------------------------------------------------------------

async function refundReport({ range, sellerId, status }) {
  let refunds = await refundService.listAllRefunds({ range });
  if (sellerId) refunds = refunds.filter((entry) => entry.sellerId === String(sellerId));
  if (status) refunds = refunds.filter((entry) => entry.status === status);

  const rows = refunds.map((entry) => ({
    orderNumber: entry.orderNumber,
    orderId: entry.orderId,
    seller: entry.seller,
    sellerId: entry.sellerId,
    amount: entry.amount,
    reason: entry.reason,
    status: entry.status,
    date: entry.createdAt,
  }));

  return {
    columns: [
      column('orderNumber', 'Order'),
      column('seller', 'Seller'),
      column('amount', 'Refund Amount', 'money'),
      column('reason', 'Reason'),
      column('status', 'Status', 'status'),
      column('date', 'Date', 'datetime'),
    ],
    rows,
    totals: {
      amount: rows.reduce((sum, row) => sum + row.amount, 0),
      completed: rows.filter((row) => row.status === 'COMPLETED').reduce((sum, row) => sum + row.amount, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const REPORTS = Object.freeze({
  sales: { name: 'Sales Report', description: 'Orders, gross sales, discounts and refunds by day', run: salesReport },
  commissions: { name: 'Commission Report', description: 'What each seller was charged, and the effective rate', run: commissionReport },
  settlements: { name: 'Seller Settlement Report', description: 'What each seller has been paid and is still owed', run: settlementReport },
  payouts: { name: 'Payout Report', description: 'Every transfer, its bank reference and its status', run: payoutReport },
  refunds: { name: 'Refund Report', description: 'Refunds by order and seller, with their accounting status', run: refundReport },
});

async function runReport(req, res) {
  const { reportKey } = req.params;
  const report = REPORTS[reportKey];
  if (!report) {
    return res.status(404).json({ success: false, message: 'Unknown report' });
  }

  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  const { sellerId, status } = req.query;
  if (sellerId && !mongoose.isValidObjectId(sellerId)) {
    return res.status(400).json({ success: false, message: 'Invalid seller id' });
  }

  await posting.reconcileLedger();

  const result = await report.run({ range, sellerId: sellerId || null, status: status || null });

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      key: reportKey,
      name: report.name,
      description: report.description,
      range: range ? { from: range.from, to: range.to, label: range.label } : null,
      generatedAt: new Date(),
      ...result,
    },
  });
}

async function listReports(req, res) {
  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      items: Object.entries(REPORTS).map(([key, report]) => ({
        key,
        name: report.name,
        description: report.description,
        formats: ['csv'],
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Audit log (task §18)
// ---------------------------------------------------------------------------

async function listAuditLog(req, res) {
  const { action, entityType, entityId, page, rowsPerPage } = req.query;
  const range = resolveRange(req.query);

  const filter = {
    ...(range ? { createdAt: { $gte: range.from, $lte: range.to } } : {}),
    ...(action && AccountingAuditLog.ACTIONS.includes(action) ? { action } : {}),
    ...(entityType && AccountingAuditLog.ENTITY_TYPES.includes(entityType) ? { entityType } : {}),
    ...(entityId ? { entityId: String(entityId) } : {}),
  };

  const rows = await AccountingAuditLog.find(filter).sort({ createdAt: -1 }).limit(1000).lean();

  const items = rows.map((entry) => ({
    id: String(entry._id),
    action: entry.action,
    admin: entry.adminName || entry.adminEmail || 'System',
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    reason: entry.reason,
    ip: entry.ip || '',
    createdAt: entry.createdAt,
  }));

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, { all: items.length }),
  });
}

module.exports = { runReport, listReports, listAuditLog, REPORTS };
