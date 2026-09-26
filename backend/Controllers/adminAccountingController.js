const mongoose = require('mongoose');
const AccountingTransaction = require('../Models/AccountingTransaction');
const Settlement = require('../Models/Settlement');
const Payout = require('../Models/Payout');
const Order = require('../Models/Order');
const Vendor = require('../Models/Vendor');
const { toPaise } = require('../utils/money');
const posting = require('../services/accountingPosting');
const settlementService = require('../services/settlementService');
const { recordAudit } = require('../services/accountingAudit');

// Admin > Accounting. Every figure on every one of these endpoints is derived
// from the ledger (Models/AccountingTransaction) or from the orders behind it
// — there is no cached total anywhere in this file, so a report and the
// ledger it reports on cannot disagree.
//
// Money leaves here as INTEGER PAISE, which is what the admin panel renders
// (frontend/src/modules/admin/lib/format.js formatMoney) and what the ledger
// already stores, so nothing is converted on this path at all.

const DEFAULT_ROWS_PER_PAGE = 25;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function vendorLabel(vendor) {
  return vendor?.business?.businessName || vendor?.name || 'Unknown seller';
}

function orderNumber(orderId) {
  return orderId ? `ORD-${String(orderId).slice(-8).toUpperCase()}` : null;
}

// Matches the envelope the rest of the admin API uses — see
// adminFinanceController.paged.
function paged(items, { page = 1, rowsPerPage = DEFAULT_ROWS_PER_PAGE }, tabCounts = {}) {
  const perPage = Math.min(Math.max(Number(rowsPerPage) || DEFAULT_ROWS_PER_PAGE, 1), 200);
  const currentPage = Math.max(Number(page) || 1, 1);
  const totalItems = items.length;
  return {
    items: items.slice((currentPage - 1) * perPage, (currentPage - 1) * perPage + perPage),
    page: currentPage,
    rowsPerPage: perPage,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
    tabCounts,
  };
}

// The Overview's range filter (task §3). Returns null for "all time" so the
// caller can leave the date clause off entirely.
function resolveRange(query) {
  const { range, from, to } = query;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n) => new Date(startOfToday.getTime() - n * 24 * 60 * 60 * 1000);

  switch (range) {
    case 'today':
      return { from: startOfToday, to: now, label: 'Today' };
    case 'yesterday':
      return { from: daysAgo(1), to: startOfToday, label: 'Yesterday' };
    case 'last_7_days':
      return { from: daysAgo(6), to: now, label: 'Last 7 days' };
    case 'last_30_days':
      return { from: daysAgo(29), to: now, label: 'Last 30 days' };
    case 'this_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: 'This month' };
    case 'previous_month':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 1),
        label: 'Previous month',
      };
    case 'custom': {
      const start = from ? new Date(from) : null;
      const end = to ? new Date(to) : null;
      if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return null;
      // Inclusive of the whole end day, which is what an operator picking
      // "1 Sep to 30 Sep" means.
      end.setHours(23, 59, 59, 999);
      return { from: start, to: end, label: 'Custom range' };
    }
    default:
      return null;
  }
}

function dateClause(range, field = 'createdAt') {
  if (!range) return {};
  return { [field]: { $gte: range.from, $lte: range.to } };
}

// Turns an aggregation of { _id: <type>, credit, debit } into a lookup.
function byType(rows) {
  return Object.fromEntries(rows.map((entry) => [entry._id, entry]));
}

function sumOf(map, type, side) {
  return map[type]?.[side] || 0;
}

// ---------------------------------------------------------------------------
// 1. Overview
// ---------------------------------------------------------------------------

async function getOverview(req, res) {
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  // Pick up anything an inline hook missed before reporting on it.
  await posting.reconcileLedger();

  const ledgerMatch = dateClause(range);
  const orderMatch = dateClause(range);

  const [
    ledgerTotals,
    platformTotals,
    orderTotals,
    paymentSplit,
    balances,
    settlementTotals,
    payoutTotals,
    recentRows,
  ] = await Promise.all([
    // Seller-attributed ledger movement.
    AccountingTransaction.aggregate([
      { $match: { vendor: { $ne: null }, ...ledgerMatch } },
      { $group: { _id: '$type', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
    ]),
    // The platform's own rows (fees it absorbed, shipping it kept).
    AccountingTransaction.aggregate([
      { $match: { vendor: null, ...ledgerMatch } },
      { $group: { _id: '$type', credit: { $sum: '$credit' }, debit: { $sum: '$debit' } } },
    ]),
    // Sales summary comes off the ORDERS, not the ledger, because gross sales
    // and discounts are properties of what was sold, not of what is owed.
    Order.aggregate([
      { $match: { ...orderMatch, $or: [{ paymentStatus: { $in: ['PAID', 'REFUNDED'] } }, { paymentMethod: 'COD', codRemittedAt: { $ne: null } }] } },
      {
        $group: {
          _id: null,
          grossSales: { $sum: '$subtotal' },
          discounts: { $sum: '$discountAmount' },
          shipping: { $sum: '$shippingFee' },
          net: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      { $group: { _id: { method: '$paymentMethod', status: '$paymentStatus' }, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    settlementService.sellerBalances(),
    Settlement.aggregate([
      { $group: { _id: '$status', total: { $sum: '$netPayablePaise' }, count: { $sum: 1 } } },
    ]),
    Payout.aggregate([{ $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    AccountingTransaction.find(ledgerMatch)
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('vendor', 'name business.businessName')
      .lean(),
  ]);

  const seller = byType(ledgerTotals);
  const platform = byType(platformTotals);
  const orders = orderTotals[0] || { grossSales: 0, discounts: 0, shipping: 0, net: 0, orders: 0 };

  const salesPaise = sumOf(seller, 'SALE', 'credit');
  const commissionPaise = sumOf(seller, 'COMMISSION', 'debit') - sumOf(seller, 'REFUND_REVERSAL', 'credit');
  const refundPaise = sumOf(seller, 'REFUND', 'debit');
  // Fees the seller was charged plus fees the platform absorbed.
  const gatewayFeePaise = sumOf(seller, 'PAYMENT_GATEWAY_FEE', 'debit') + sumOf(platform, 'PAYMENT_GATEWAY_FEE', 'debit');
  const shippingRevenuePaise = sumOf(seller, 'SHIPPING_CHARGE', 'credit') + sumOf(platform, 'SHIPPING_CHARGE', 'credit');

  const sellerPayablePaise = balances.reduce((sum, entry) => sum + entry.currentPayablePaise, 0);
  const settlementByStatus = byType(settlementTotals.map((entry) => ({ _id: entry._id, credit: entry.total, debit: entry.count })));
  const pendingSettlementPaise =
    sumOf(settlementByStatus, 'ELIGIBLE', 'credit') +
    sumOf(settlementByStatus, 'PENDING', 'credit') +
    sumOf(settlementByStatus, 'AWAITING_APPROVAL', 'credit') +
    sumOf(settlementByStatus, 'PROCESSING', 'credit');
  const onHoldPaise = sumOf(settlementByStatus, 'ON_HOLD', 'credit');

  const payoutByStatus = byType(payoutTotals.map((entry) => ({ _id: entry._id, credit: entry.total, debit: entry.count })));
  const completedPayoutPaise = sumOf(payoutByStatus, 'COMPLETED', 'credit');

  // What the marketplace itself earned: commission and any shipping it kept,
  // less the gateway fees and the discounts it funded.
  const platformFundedDiscountRows = await AccountingTransaction.aggregate([
    { $match: { type: 'SALE', ...ledgerMatch } },
    { $group: { _id: null, total: { $sum: '$metadata.platformFundedDiscountPaise' } } },
  ]);
  const platformFundedDiscountPaise = platformFundedDiscountRows[0]?.total || 0;
  const netPlatformRevenuePaise =
    commissionPaise +
    sumOf(platform, 'SHIPPING_CHARGE', 'credit') +
    sumOf(platform, 'PLATFORM_FEE', 'credit') -
    sumOf(platform, 'PAYMENT_GATEWAY_FEE', 'debit') -
    platformFundedDiscountPaise;

  // Net sales = gross, less what was discounted off it, less what came back.
  // Shipping is deliberately NOT in here: the buyer paid it, but it is not
  // revenue from selling goods, and it is reported on its own card. Putting it
  // in would make "net sales" larger than "total sales" on an order with
  // refunds, which reads as a bug even when the arithmetic is right.
  const netSalesPaise = toPaise(orders.grossSales) - toPaise(orders.discounts) - refundPaise;

  const paymentSummary = { online: 0, cod: 0, failed: 0, refunded: 0 };
  for (const entry of paymentSplit) {
    const amount = toPaise(entry.total);
    if (entry._id.status === 'FAILED') paymentSummary.failed += amount;
    else if (entry._id.status === 'REFUNDED') paymentSummary.refunded += amount;
    else if (entry._id.status === 'PAID') {
      if (entry._id.method === 'COD') paymentSummary.cod += amount;
      else paymentSummary.online += amount;
    }
  }

  const kpi = (key, label, value, caption, tone) => ({
    key,
    label,
    value,
    format: 'money',
    delta: null,
    caption,
    ...(tone ? { tone } : {}),
  });

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      range: range ? { from: range.from, to: range.to, label: range.label } : null,
      kpis: [
        kpi('total_sales', 'Total Sales', toPaise(orders.grossSales), `${orders.orders} orders with money received`, 'brand'),
        kpi('net_sales', 'Net Sales', netSalesPaise, 'Gross less discounts and refunds'),
        kpi('commission', 'Platform Commission', commissionPaise, 'Net of reversals on refunds'),
        kpi('seller_payable', 'Seller Payable', sellerPayablePaise, 'Owed across every seller ledger'),
        kpi('pending_settlement', 'Pending Settlement', pendingSettlementPaise, 'Drafted but not yet paid'),
        kpi('completed_payouts', 'Completed Payouts', completedPayoutPaise, 'Money that has left the platform'),
        kpi('refunds', 'Refund Amount', refundPaise, 'Returned to buyers'),
        kpi('gateway_fees', 'Payment Gateway Fees', gatewayFeePaise, 'Charged on online captures'),
        kpi('shipping_revenue', 'Shipping Revenue', shippingRevenuePaise, 'Collected from buyers'),
        kpi('net_platform_revenue', 'Net Platform Revenue', netPlatformRevenuePaise, 'Commission less fees and funded discounts'),
      ],
      salesSummary: {
        grossSales: toPaise(orders.grossSales),
        discounts: toPaise(orders.discounts),
        refunds: refundPaise,
        netSales: netSalesPaise,
        orders: orders.orders,
      },
      sellerPayableSummary: {
        totalPayable: sellerPayablePaise,
        settlementPending: pendingSettlementPaise,
        settlementEligible: balances.reduce((sum, entry) => sum + entry.settlementEligiblePaise, 0),
        onHold: onHoldPaise,
        alreadyPaid: completedPayoutPaise,
      },
      paymentSummary: {
        online: paymentSummary.online,
        cod: paymentSummary.cod,
        failed: paymentSummary.failed,
        refunded: paymentSummary.refunded,
      },
      recentTransactions: recentRows.map((entry) => ({
        id: String(entry._id),
        transactionId: entry.transactionId,
        type: entry.type,
        orderId: entry.order ? String(entry.order) : null,
        orderNumber: orderNumber(entry.order),
        seller: entry.vendor ? vendorLabel(entry.vendor) : 'Platform',
        amount: entry.amount,
        direction: entry.direction,
        status: entry.status,
        createdAt: entry.createdAt,
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Transactions
// ---------------------------------------------------------------------------

function serializeTransaction(entry) {
  return {
    id: String(entry._id),
    transactionId: entry.transactionId,
    orderId: entry.order ? String(entry.order) : null,
    orderNumber: orderNumber(entry.order),
    sellerId: entry.vendor ? String(entry.vendor._id || entry.vendor) : null,
    seller: entry.vendor?.name || entry.vendor?.business?.businessName ? vendorLabel(entry.vendor) : entry.vendor ? '' : 'Platform',
    type: entry.type,
    direction: entry.direction,
    credit: entry.credit,
    debit: entry.debit,
    net: entry.credit - entry.debit,
    amount: entry.amount,
    status: entry.status,
    reference: entry.referenceId ? String(entry.referenceId) : entry.transactionId,
    referenceType: entry.referenceType,
    paymentMethod: entry.metadata?.paymentMethod || null,
    createdAt: entry.createdAt,
  };
}

async function listTransactions(req, res) {
  const { tab, type, status, sellerId, paymentMethod, orderId, transactionId, search, page, rowsPerPage } = req.query;
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  await posting.reconcileLedger();

  const filter = { ...dateClause(range) };

  if (type && AccountingTransaction.TYPES.includes(type)) filter.type = type;
  if (status && AccountingTransaction.STATUSES.includes(status)) filter.status = status;
  if (sellerId) {
    if (!mongoose.isValidObjectId(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller id' });
    }
    filter.vendor = new mongoose.Types.ObjectId(sellerId);
  }
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }
    filter.order = new mongoose.Types.ObjectId(orderId);
  }
  if (transactionId) filter.transactionId = String(transactionId).trim().toUpperCase();
  if (paymentMethod && Order.PAYMENT_METHODS.includes(paymentMethod)) {
    filter['metadata.paymentMethod'] = paymentMethod;
  }

  // Tabs are a coarser cut of the same `type` filter.
  const TAB_TYPES = {
    sales: ['SALE'],
    commission: ['COMMISSION'],
    refunds: ['REFUND', 'REFUND_REVERSAL'],
    payouts: ['PAYOUT'],
    fees: ['PAYMENT_GATEWAY_FEE', 'SHIPPING_CHARGE', 'PLATFORM_FEE'],
    adjustments: ['ADJUSTMENT'],
  };
  if (tab && TAB_TYPES[tab] && !filter.type) filter.type = { $in: TAB_TYPES[tab] };

  const [rows, tabRows] = await Promise.all([
    AccountingTransaction.find(filter)
      .sort({ createdAt: -1 })
      .populate('vendor', 'name business.businessName')
      .lean(),
    AccountingTransaction.aggregate([
      { $match: dateClause(range) },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  let items = rows.map(serializeTransaction);

  // Search spans the three identifiers an operator actually has to hand.
  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (entry) =>
        entry.transactionId.toLowerCase().includes(term) ||
        (entry.orderNumber || '').toLowerCase().includes(term) ||
        (entry.orderId || '').toLowerCase().includes(term) ||
        entry.seller.toLowerCase().includes(term)
    );
  }

  const counts = Object.fromEntries(tabRows.map((entry) => [entry._id, entry.count]));
  const total = tabRows.reduce((sum, entry) => sum + entry.count, 0);
  const tabCounts = {
    all: total,
    sales: counts.SALE || 0,
    commission: counts.COMMISSION || 0,
    refunds: (counts.REFUND || 0) + (counts.REFUND_REVERSAL || 0),
    payouts: counts.PAYOUT || 0,
    fees: (counts.PAYMENT_GATEWAY_FEE || 0) + (counts.SHIPPING_CHARGE || 0) + (counts.PLATFORM_FEE || 0),
    adjustments: counts.ADJUSTMENT || 0,
  };

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, tabCounts),
  });
}

async function getTransaction(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid transaction id' });
  }

  const entry = await AccountingTransaction.findById(id)
    .populate('vendor', 'name business.businessName')
    .populate('customer', 'name mobileNumber')
    .populate('settlement', 'settlementId status')
    .populate('payout', 'payoutId status utr')
    .lean();

  if (!entry) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  // The related rows for the same order line, so the detail view can show the
  // whole story of one sale (what was sold, what was charged, what came back)
  // rather than one row in isolation.
  const siblings = entry.order
    ? await AccountingTransaction.find({
        order: entry.order,
        ...(entry.product ? { product: entry.product } : {}),
        _id: { $ne: entry._id },
      })
        .sort({ createdAt: 1 })
        .lean()
    : [];

  const order = entry.order
    ? await Order.findById(entry.order).select('items subtotal discountAmount shippingFee total paymentMethod paymentStatus couponCode createdAt').lean()
    : null;

  const line = order && entry.product
    ? order.items.find((item) => String(item.product) === String(entry.product))
    : null;

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      ...serializeTransaction(entry),
      customerId: entry.customer ? String(entry.customer._id) : null,
      customer: entry.customer?.name || null,
      settlementId: entry.settlement?.settlementId || null,
      settlementRef: entry.settlement ? String(entry.settlement._id) : null,
      payoutId: entry.payout?.payoutId || null,
      payoutRef: entry.payout ? String(entry.payout._id) : null,
      paymentGatewayId: entry.paymentReference || null,
      refundId: entry.returnRequest ? String(entry.returnRequest) : null,
      reversalOf: entry.reversalOf ? String(entry.reversalOf) : null,
      description: entry.description,
      metadata: entry.metadata || {},
      currency: entry.currency,
      updatedAt: entry.updatedAt,
      productName: line?.name || null,
      orderSummary: order
        ? {
            subtotal: toPaise(order.subtotal),
            discount: toPaise(order.discountAmount),
            shipping: toPaise(order.shippingFee),
            total: toPaise(order.total),
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            couponCode: order.couponCode,
            placedAt: order.createdAt,
          }
        : null,
      relatedEntries: siblings.map((row) => ({
        id: String(row._id),
        transactionId: row.transactionId,
        type: row.type,
        direction: row.direction,
        amount: row.amount,
        createdAt: row.createdAt,
      })),
    },
  });
}

// POST /admin/accounting/transactions/cod-remittance
// Records that the courier has handed over the cash for a delivered COD
// order — the point at which the platform has actually received the money
// (task §12).
async function recordCodRemittance(req, res) {
  const { orderId, reference } = req.body;

  const result = await posting.recordCodRemittance({
    orderId,
    reference,
    createdBy: req.admin?._id || null,
  });
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  await recordAudit({
    action: 'COD_REMITTANCE_RECORDED',
    req,
    entityType: 'Order',
    entityId: orderId,
    before: { codRemittedAt: null, paymentStatus: 'PENDING' },
    after: { codRemittedAt: result.order.codRemittedAt, paymentStatus: 'PAID' },
    reason: reference ? `Courier reference ${reference}` : '',
  });

  res.json({
    success: true,
    message: 'COD collection recorded',
    data: {
      orderId: String(result.order._id),
      orderNumber: orderNumber(result.order._id),
      codRemittedAt: result.order.codRemittedAt,
      transactionsPosted: result.posted.posted,
    },
  });
}

// GET /admin/accounting/transactions/cod-pending — delivered COD orders whose
// cash the courier has not remitted yet.
async function listPendingCod(req, res) {
  const { page, rowsPerPage, search } = req.query;

  const orders = await Order.find({ paymentMethod: 'COD', status: 'DELIVERED', codRemittedAt: null })
    .populate('user', 'name')
    .sort({ deliveredAt: 1 })
    .lean();

  let items = orders.map((order) => ({
    id: String(order._id),
    orderId: String(order._id),
    orderNumber: orderNumber(order._id),
    buyer: order.user?.name || '',
    amount: toPaise(order.total),
    deliveredAt: order.deliveredAt,
    sellers: [...new Set(order.items.filter((item) => item.vendor).map((item) => String(item.vendor)))].length,
  }));

  const term = String(search || '').trim().toLowerCase();
  if (term) {
    items = items.filter(
      (entry) => entry.orderNumber.toLowerCase().includes(term) || entry.buyer.toLowerCase().includes(term)
    );
  }

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, { all: items.length }),
  });
}

// ---------------------------------------------------------------------------
// 3. Seller ledger
// ---------------------------------------------------------------------------

async function listSellerLedgers(req, res) {
  const { tab, search, page, rowsPerPage } = req.query;

  await posting.reconcileLedger();

  const balances = await settlementService.sellerBalances();
  const vendors = await Vendor.find({ _id: { $in: balances.map((entry) => entry.vendor) } })
    .select('name business.businessName vendorType isActive')
    .lean();
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  let items = balances
    .map((entry) => {
      const vendor = vendorById.get(String(entry.vendor));
      return {
        id: String(entry.vendor),
        seller: vendorLabel(vendor),
        sellerType: vendor?.vendorType || null,
        isActive: Boolean(vendor?.isActive),
        totalSales: entry.salesPaise + entry.shippingPaise,
        totalCommission: entry.commissionPaise,
        totalFees: entry.feesPaise,
        totalRefunds: entry.refundsPaise,
        totalAdjustments: entry.adjustmentsPaise,
        totalPaid: entry.paidPaise,
        currentPayable: entry.currentPayablePaise,
        onHold: entry.onHoldPaise,
        availableForSettlement: entry.settlementEligiblePaise,
        entries: entry.entries,
        lastEntryAt: entry.lastEntryAt,
        lastPaidAt: entry.lastPaidAt,
      };
    })
    .sort((a, b) => b.currentPayable - a.currentPayable);

  const all = items.slice();
  const term = String(search || '').trim().toLowerCase();
  if (term) items = items.filter((entry) => entry.seller.toLowerCase().includes(term));

  if (tab === 'owing') items = items.filter((entry) => entry.currentPayable > 0);
  else if (tab === 'negative') items = items.filter((entry) => entry.currentPayable < 0);
  else if (tab === 'on_hold') items = items.filter((entry) => entry.onHold > 0);
  else if (tab === 'settled') items = items.filter((entry) => entry.currentPayable === 0 && entry.totalPaid > 0);

  const tabCounts = {
    all: all.length,
    owing: all.filter((entry) => entry.currentPayable > 0).length,
    negative: all.filter((entry) => entry.currentPayable < 0).length,
    on_hold: all.filter((entry) => entry.onHold > 0).length,
    settled: all.filter((entry) => entry.currentPayable === 0 && entry.totalPaid > 0).length,
  };

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: paged(items, { page, rowsPerPage }, tabCounts),
  });
}

async function getSellerLedger(req, res) {
  const { sellerId } = req.params;
  const { type, orderId, settlementId, payoutId, page, rowsPerPage } = req.query;

  if (!mongoose.isValidObjectId(sellerId)) {
    return res.status(400).json({ success: false, message: 'Invalid seller id' });
  }
  const range = resolveRange(req.query);
  if (req.query.range === 'custom' && !range) {
    return res.status(400).json({ success: false, message: 'Enter a valid start and end date' });
  }

  const vendor = await Vendor.findById(sellerId).select('name business.businessName business.gstin vendorType isActive').lean();
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Seller not found' });
  }

  await posting.reconcileLedger();

  const vendorObjectId = new mongoose.Types.ObjectId(sellerId);
  const [balance] = await settlementService.sellerBalances({ vendorId: vendorObjectId });

  // The running balance has to be computed over EVERY row in order, then
  // filtered — a filtered view whose balance column restarts at the first
  // visible row would be telling the operator something untrue.
  const all = await AccountingTransaction.find({ vendor: vendorObjectId })
    .sort({ createdAt: 1, _id: 1 })
    .populate('settlement', 'settlementId')
    .populate('payout', 'payoutId')
    .lean();

  let running = 0;
  const withBalance = all.map((entry, index) => {
    running += entry.credit - entry.debit;
    return {
      sn: index + 1,
      id: String(entry._id),
      transactionId: entry.transactionId,
      date: entry.createdAt,
      reference: entry.transactionId,
      orderId: entry.order ? String(entry.order) : null,
      orderNumber: orderNumber(entry.order),
      settlementId: entry.settlement?.settlementId || null,
      settlementRef: entry.settlement ? String(entry.settlement._id) : null,
      payoutId: entry.payout?.payoutId || null,
      payoutRef: entry.payout ? String(entry.payout._id) : null,
      type: entry.type,
      credit: entry.credit,
      debit: entry.debit,
      runningBalance: running,
      description: entry.description,
    };
  });

  let items = withBalance;
  if (type && AccountingTransaction.TYPES.includes(type)) items = items.filter((entry) => entry.type === type);
  if (range) items = items.filter((entry) => entry.date >= range.from && entry.date <= range.to);
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }
    items = items.filter((entry) => entry.orderId === String(orderId));
  }
  if (settlementId) items = items.filter((entry) => entry.settlementRef === String(settlementId));
  if (payoutId) items = items.filter((entry) => entry.payoutRef === String(payoutId));

  // Newest first for reading, even though the balance was accumulated oldest
  // first.
  items = items.slice().reverse();

  const summary = balance || {
    salesPaise: 0,
    shippingPaise: 0,
    commissionPaise: 0,
    feesPaise: 0,
    refundsPaise: 0,
    adjustmentsPaise: 0,
    paidPaise: 0,
    currentPayablePaise: 0,
    onHoldPaise: 0,
    settlementEligiblePaise: 0,
    settledPaise: 0,
  };

  res.json({
    success: true,
    message: 'Accounting data fetched successfully',
    data: {
      sellerId: String(vendor._id),
      seller: vendorLabel(vendor),
      sellerType: vendor.vendorType,
      isActive: Boolean(vendor.isActive),
      gstin: vendor.business?.gstin || '',
      summary: {
        totalSales: summary.salesPaise + summary.shippingPaise,
        totalCommission: summary.commissionPaise,
        totalFees: summary.feesPaise,
        totalRefunds: summary.refundsPaise,
        totalAdjustments: summary.adjustmentsPaise,
        totalPaid: summary.paidPaise,
        currentPayable: summary.currentPayablePaise,
        onHold: summary.onHoldPaise,
        availableForSettlement: summary.settlementEligiblePaise,
        settled: summary.settledPaise,
      },
      ledger: paged(items, { page, rowsPerPage }, { all: withBalance.length }),
    },
  });
}

// POST /admin/accounting/seller-ledger/:sellerId/adjustments (task §19)
async function createAdjustment(req, res) {
  const { sellerId } = req.params;
  const { amount, direction, reason, orderId } = req.body;

  // Operators type rupees; the ledger holds paise. The conversion happens
  // here, at the edge, and nowhere else.
  const amountPaise = toPaise(Number(amount));

  const result = await posting.postAdjustment({
    vendorId: sellerId,
    amountPaise,
    direction: String(direction || '').toUpperCase(),
    reason,
    orderId: orderId || null,
    createdBy: req.admin?._id || null,
  });

  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  await recordAudit({
    action: 'MANUAL_ADJUSTMENT_CREATED',
    req,
    entityType: 'AccountingTransaction',
    entityId: result.transaction._id,
    before: null,
    after: {
      seller: sellerId,
      direction: result.transaction.direction,
      amountPaise: result.transaction.amount,
      transactionId: result.transaction.transactionId,
    },
    reason: String(reason).trim(),
  });

  res.status(201).json({
    success: true,
    message: 'Adjustment recorded',
    data: serializeTransaction(result.transaction.toObject ? result.transaction.toObject() : result.transaction),
  });
}

module.exports = {
  // shared
  paged,
  resolveRange,
  dateClause,
  vendorLabel,
  orderNumber,
  serializeTransaction,
  // overview
  getOverview,
  // transactions
  listTransactions,
  getTransaction,
  recordCodRemittance,
  listPendingCod,
  // seller ledger
  listSellerLedgers,
  getSellerLedger,
  createAdjustment,
};
