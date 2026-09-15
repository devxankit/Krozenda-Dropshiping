const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const ReturnRequest = require('../Models/ReturnRequest');
const Ticket = require('../Models/Ticket');
const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const { isFirebaseConfigured } = require('../Config/firebase');
const { toPaise } = require('../utils/money');
const { IST_TZ, buildBuckets, resolveRange } = require('../utils/analyticsRange');

// Read-only reporting surface for the admin panel: GET /admin/dashboard,
// /admin/dashboard-summary and /admin/analytics/sales. Every figure here is
// aggregated from the live collections for the requested window — nothing on
// these screens is seeded, cached or hardcoded.
//
// Money leaves this file in PAISE (see utils/money.js); counts and rates
// leave as plain numbers.

// ---------------------------------------------------------------------------
// Business model attribution
//
// This platform has no `businessModel` column: what a line item is depends on
// who owns the product that was bought. That mapping lives here, once, so the
// dashboard's revenue split and the analytics order mix can never disagree.
//   - no vendor  -> own stock (platform-owned catalog)
//   - B2C seller -> marketplace
//   - B2B seller -> direct dropshipping
// ---------------------------------------------------------------------------
const BUSINESS_MODEL = Object.freeze({
  DROPSHIPPING: 'dropshipping',
  MARKETPLACE: 'marketplace',
  OWN_STOCK: 'own_stock',
});

const BUSINESS_MODEL_LABELS = Object.freeze({
  [BUSINESS_MODEL.MARKETPLACE]: 'Marketplace',
  [BUSINESS_MODEL.DROPSHIPPING]: 'Direct dropshipping',
  [BUSINESS_MODEL.OWN_STOCK]: 'Own stock',
});

const MODEL_ORDER = [
  BUSINESS_MODEL.MARKETPLACE,
  BUSINESS_MODEL.DROPSHIPPING,
  BUSINESS_MODEL.OWN_STOCK,
];

const PAYMENT_METHOD_LABELS = Object.freeze({
  RAZORPAY: 'Online (Razorpay)',
  WALLET: 'Wallet',
  COD: 'Cash on delivery',
});

const STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
});

// The lifecycle as a funnel — cancellations leave it, and are reported as an
// exception branch rather than a stage.
const PIPELINE_STAGES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

// Money has actually been taken when the gateway or wallet captured it, or
// when a COD order was delivered and the courier collected cash.
const CAPTURED = {
  $or: [
    { $eq: ['$paymentStatus', 'PAID'] },
    { $and: [{ $eq: ['$paymentMethod', 'COD'] }, { $eq: ['$status', 'DELIVERED'] }] },
  ],
};

const NOT_CANCELLED = { $ne: ['$status', 'CANCELLED'] };

const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_TZ } };

// Resolves each line item to its seller and business model, and gives it its
// pro-rata share of the order total — coupon discounts and shipping are
// charged on the order, not the line, so splitting the total by line value is
// the only attribution under which the per-model bands add back up to GMV.
const ATTRIBUTE_LINES = [
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.product',
      foreignField: '_id',
      as: 'productDoc',
      pipeline: [{ $project: { vendor: 1, category: 1 } }],
    },
  },
  { $set: { productDoc: { $first: '$productDoc' } } },
  { $set: { vendorId: { $ifNull: ['$items.vendor', '$productDoc.vendor'] } } },
  {
    $lookup: {
      from: 'vendors',
      localField: 'vendorId',
      foreignField: '_id',
      as: 'vendorDoc',
      pipeline: [{ $project: { name: 1, vendorType: 1, businessName: '$business.businessName' } }],
    },
  },
  { $set: { vendorDoc: { $first: '$vendorDoc' } } },
  {
    $set: {
      model: {
        $switch: {
          branches: [
            { case: { $eq: ['$vendorDoc.vendorType', 'B2B'] }, then: BUSINESS_MODEL.DROPSHIPPING },
            { case: { $eq: ['$vendorDoc.vendorType', 'B2C'] }, then: BUSINESS_MODEL.MARKETPLACE },
          ],
          default: BUSINESS_MODEL.OWN_STOCK,
        },
      },
      lineRevenue: {
        $multiply: [
          '$total',
          {
            $divide: [
              { $multiply: ['$items.price', '$items.quantity'] },
              { $max: [{ $ifNull: ['$subtotal', 0] }, 1] },
            ],
          },
        ],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// A delta is always this window against the one immediately before it.
// `sentiment` says whether the movement is good news: the arrow follows the
// movement, the colour follows the sentiment (a rising refund rate is still a
// red "up"), and a window with no prior data gets no delta at all rather than
// an invented one.
function delta(current, previous, { lowerIsBetter = false } = {}) {
  if (!previous) return null;

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const direction = Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down';
  const improved = lowerIsBetter ? change < 0 : change > 0;

  return {
    direction,
    label: `${Math.abs(change).toFixed(1)}%`,
    sentiment: direction === 'flat' ? 'neutral' : improved ? 'positive' : 'negative',
  };
}

// Percentage-point delta, for a KPI that is itself a rate.
function pointDelta(current, previous, { lowerIsBetter = false } = {}) {
  if (previous === null || previous === undefined) return null;

  const change = current - previous;
  const direction = Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down';
  const improved = lowerIsBetter ? change < 0 : change > 0;

  return {
    direction,
    label: `${Math.abs(change).toFixed(1)} pt`,
    sentiment: direction === 'flat' ? 'neutral' : improved ? 'positive' : 'negative',
  };
}

const keyBy = (rows) => rows.reduce((map, row) => map.set(row._id, row), new Map());
const rate = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(1)) : 0);
const count = (value) => (value || 0).toLocaleString('en-IN');

// Folds day-keyed aggregation rows into the buckets a chart plots.
function toSeries(buckets, indexByDay, rows, valueKeys) {
  const series = buckets.map((bucket) => {
    const point = { label: bucket.label };
    valueKeys.forEach((key) => {
      point[key] = 0;
    });
    return point;
  });

  rows.forEach((row) => {
    const index = indexByDay.get(row.day);
    if (index === undefined) return;
    valueKeys.forEach((key) => {
      series[index][key] += row[key] || 0;
    });
  });

  return series;
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

// Everything the order collection can answer about one window, in one pass.
function orderFacts(start, end) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: [NOT_CANCELLED, '$total', 0] } },
              captured: { $sum: { $cond: [CAPTURED, '$total', 0] } },
              refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'REFUNDED'] }, '$total', 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
              units: { $sum: { $sum: '$items.quantity' } },
              codPending: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$paymentMethod', 'COD'] },
                        { $eq: ['$paymentStatus', 'PENDING'] },
                        NOT_CANCELLED,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        byDay: [
          {
            $group: {
              _id: dayExpr,
              orders: { $sum: 1 },
              revenue: { $sum: { $cond: [NOT_CANCELLED, '$total', 0] } },
              refunds: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'REFUNDED'] }, '$total', 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPaymentMethod: [
          { $match: { $expr: CAPTURED } },
          { $group: { _id: '$paymentMethod', count: { $sum: 1 }, value: { $sum: '$total' } } },
        ],
      },
    },
  ]);
}

function normaliseFacts([facts]) {
  const totals = (facts.totals && facts.totals[0]) || {};

  return {
    orders: totals.orders || 0,
    revenue: totals.revenue || 0,
    captured: totals.captured || 0,
    refunded: totals.refunded || 0,
    cancelled: totals.cancelled || 0,
    units: totals.units || 0,
    codPending: totals.codPending || 0,
    byDay: facts.byDay.map((row) => ({ ...row, day: row._id })),
    byStatus: keyBy(facts.byStatus),
    byPaymentMethod: facts.byPaymentMethod,
  };
}

// Revenue per day per business model, for the stacked dashboard chart.
function revenueByModelByDay(start, end) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } } },
    ...ATTRIBUTE_LINES,
    { $group: { _id: { day: dayExpr, model: '$model' }, revenue: { $sum: '$lineRevenue' } } },
  ]);
}

// Refunds actually paid back out in the window: wallet credits from approved
// return requests. Cancellation refunds are counted separately off the order
// itself (paymentStatus REFUNDED) — the two paths never touch the same money,
// since adminReturnController credits the wallet without moving paymentStatus,
// so they add rather than double count.
function returnRefundsByDay(start, end) {
  return ReturnRequest.aggregate([
    { $match: { status: 'APPROVED', requestType: 'REFUND', resolvedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: IST_TZ } },
        refunds: { $sum: { $ifNull: ['$refundAmount', 0] } },
      },
    },
  ]);
}

function refundTotal(rows) {
  return rows.reduce((sum, row) => sum + (row.refunds || 0), 0);
}

// Sub-orders per business model: an order split across two sellers counts
// once for each, which is what "share of order volume" means on a
// multi-vendor marketplace.
function ordersByModel(start, end) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } } },
    ...ATTRIBUTE_LINES,
    { $group: { _id: { order: '$_id', model: '$model' } } },
    { $group: { _id: '$_id.model', value: { $sum: 1 } } },
  ]);
}

function categoryRevenue(start, end) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } } },
    ...ATTRIBUTE_LINES,
    {
      $group: {
        _id: '$productDoc.category',
        revenue: { $sum: '$lineRevenue' },
        orders: { $addToSet: '$_id' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 6 },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryDoc',
        pipeline: [{ $project: { name: 1 } }],
      },
    },
    {
      $project: {
        label: { $ifNull: [{ $first: '$categoryDoc.name' }, 'Uncategorised'] },
        revenue: 1,
        orders: { $size: '$orders' },
      },
    },
  ]);
}

// Every counter behind the "needs your attention" list. These are open-ended
// queues, so they are deliberately NOT scoped to the selected range — a KYC
// application sitting for two months still needs review today.
async function dashboardQueues() {
  const [kyc, ordersPending, returnsPending, refundedOrders, tickets, lowStock] = await Promise.all([
    Vendor.countDocuments({ verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
    Order.countDocuments({ status: 'PENDING' }),
    ReturnRequest.countDocuments({ status: 'PENDING' }),
    Order.countDocuments({ paymentStatus: 'REFUNDED' }),
    Ticket.countDocuments({ status: { $in: ['open', 'waiting'] }, targetRole: 'admin' }),
    Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
  ]);

  return { kyc, ordersPending, returnsPending, refundedOrders, tickets, lowStock };
}

// Zero-count rows are dropped rather than rendered as "0 to do" noise.
function buildActionQueue(queue) {
  return [
    {
      id: 'kyc',
      icon: 'kyc',
      tone: 'warning',
      title: 'Seller KYC to review',
      subtitle: 'Pending and under review',
      count: queue.kyc,
      to: '/admin/people/kyc',
    },
    {
      id: 'orders',
      icon: 'orders',
      tone: 'brand',
      title: 'Orders awaiting processing',
      subtitle: 'Placed, not yet picked up',
      count: queue.ordersPending,
      to: '/admin/orders',
    },
    {
      id: 'returns',
      icon: 'returns',
      tone: 'danger',
      title: 'Return requests to decide',
      subtitle: 'Refund and replacement claims',
      count: queue.returnsPending,
      to: '/admin/orders/returns',
    },
    {
      id: 'tickets',
      icon: 'support',
      tone: 'warning',
      title: 'Support tickets with admin',
      subtitle: 'Open or waiting on us',
      count: queue.tickets,
      to: '/admin/support/tickets',
    },
    {
      id: 'stock',
      icon: 'inventory',
      tone: 'danger',
      title: 'Products low or out of stock',
      subtitle: 'Five units or fewer on hand',
      count: queue.lowStock,
      to: '/admin/catalog/inventory',
    },
  ]
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count);
}

async function sellerCounts() {
  const [active, pendingKyc] = await Promise.all([
    Vendor.countDocuments({ isActive: true, verificationStatus: 'APPROVED' }),
    Vendor.countDocuments({ verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
  ]);

  return { active, pendingKyc };
}

// Reported from what this server can actually see: the live database
// connection and which provider credentials are present. Nothing here is a
// decorative "operational" badge.
function integrationHealth() {
  const razorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const readyState = mongoose.connection.readyState;

  return [
    {
      id: 'mongodb',
      name: 'Database',
      status: readyState === 1 ? 'operational' : readyState === 2 ? 'degraded' : 'down',
      note: readyState === 1 ? null : 'Connection lost',
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      status: razorpay ? 'operational' : 'not_configured',
      note: razorpay ? null : 'API keys not set',
    },
    {
      id: 'fcm',
      name: 'Firebase FCM',
      status: isFirebaseConfigured ? 'operational' : 'not_configured',
      note: isFirebaseConfigured ? null : 'Service account not set',
    },
    {
      id: 'sms',
      name: 'SMS gateway',
      status: process.env.SMS_API_KEY ? 'operational' : 'not_configured',
      note: process.env.SMS_API_KEY ? null : 'OTPs go to the server log',
    },
    {
      id: 'shipping',
      name: 'Courier',
      status: process.env.SHIPPING_API_KEY ? 'operational' : 'not_configured',
      note: process.env.SHIPPING_API_KEY ? null : 'Manual dispatch',
    },
  ];
}

// The most recent orders, split the way the panel thinks about them: one row
// per seller within an order. An order carrying items from two sellers is two
// sub-orders, suffixed -A and -B, each with its own share of the total.
async function recentSubOrderRows() {
  const rows = await Order.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 8 },
    ...ATTRIBUTE_LINES,
    {
      $group: {
        _id: { order: '$_id', vendor: '$vendorId' },
        createdAt: { $first: '$createdAt' },
        status: { $first: '$status' },
        model: { $first: '$model' },
        vendorName: { $first: '$vendorDoc.name' },
        vendorBusiness: { $first: '$vendorDoc.businessName' },
        total: { $sum: '$lineRevenue' },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  const suffixes = new Map();

  return rows.slice(0, 6).map((row) => {
    const orderId = row._id.order.toString();
    const index = suffixes.get(orderId) || 0;
    suffixes.set(orderId, index + 1);

    return {
      id: `${orderId.slice(-8).toUpperCase()}-${String.fromCharCode(65 + index)}`,
      orderId,
      seller: row.vendorBusiness || row.vendorName || 'Krozenda own stock',
      model: row.model,
      status: row.status,
      total: toPaise(row.total),
    };
  });
}

// ---------------------------------------------------------------------------
// GET /admin/dashboard?range=7d|30d|90d|fy
// ---------------------------------------------------------------------------
async function getDashboard(req, res) {
  const range = resolveRange(req.query.range);
  const { buckets, indexByDay } = buildBuckets(range);

  const [facts, previousFacts, modelRows, queue, sellers, recentSubOrders] = await Promise.all([
    orderFacts(range.start, range.end).then(normaliseFacts),
    orderFacts(range.previous.start, range.previous.end).then(normaliseFacts),
    revenueByModelByDay(range.start, range.end),
    dashboardQueues(),
    sellerCounts(),
    recentSubOrderRows(),
  ]);

  const aov = facts.orders ? facts.revenue / facts.orders : 0;
  const previousAov = previousFacts.orders ? previousFacts.revenue / previousFacts.orders : 0;
  const openOrders =
    (facts.byStatus.get('PENDING')?.count || 0) + (facts.byStatus.get('PROCESSING')?.count || 0);

  const trend = toSeries(buckets, indexByDay, facts.byDay, ['revenue', 'orders']);

  // With nothing to compare against, the tile says so rather than captioning
  // a comparison that is not being made.
  const gmvDelta = delta(facts.revenue, previousFacts.revenue);

  const modelSeries = toSeries(
    buckets,
    indexByDay,
    modelRows.map((row) => ({ day: row._id.day, [row._id.model]: row.revenue })),
    MODEL_ORDER,
  );

  res.json({
    success: true,
    data: {
      updatedAt: new Date().toISOString(),
      range: range.id,
      rangeLabel: range.label,
      granularity: range.granularity,

      kpis: [
        {
          key: 'gmv',
          label: 'Gross merchandise value',
          value: toPaise(facts.revenue),
          format: 'money',
          delta: gmvDelta,
          caption: gmvDelta
            ? `vs previous ${range.shortLabel}`
            : `nothing sold in the previous ${range.shortLabel}`,
          trend: trend.map((point) => ({ value: Math.round(point.revenue) })),
        },
        {
          key: 'orders',
          label: 'Orders placed',
          value: facts.orders,
          format: 'count',
          delta: delta(facts.orders, previousFacts.orders),
          caption: `${count(openOrders)} awaiting fulfilment`,
          trend: trend.map((point) => ({ value: point.orders })),
        },
        {
          key: 'aov',
          label: 'Average order value',
          value: toPaise(aov),
          format: 'money',
          delta: delta(aov, previousAov),
          caption: facts.orders
            ? `${(facts.units / facts.orders).toFixed(1)} items per order`
            : 'No orders in this window',
        },
        {
          key: 'captured',
          label: 'Payments captured',
          value: toPaise(facts.captured),
          format: 'money',
          delta: delta(facts.captured, previousFacts.captured),
          caption: `${count(facts.codPending)} COD orders yet to collect`,
          tone: 'brand',
        },
        {
          key: 'sellers',
          label: 'Active sellers',
          value: sellers.active,
          format: 'count',
          delta: null,
          caption: `${count(sellers.pendingKyc)} awaiting KYC`,
        },
      ],

      revenueByModel: modelSeries.map((point) => ({
        label: point.label,
        ...Object.fromEntries(MODEL_ORDER.map((model) => [model, toPaise(point[model])])),
      })),

      pipeline: PIPELINE_STAGES.map((status) => ({
        status,
        label: STATUS_LABELS[status],
        count: facts.byStatus.get(status)?.count || 0,
      })),

      exceptions: [
        { label: 'Cancelled', count: facts.cancelled, tone: 'danger' },
        { label: 'Returns open', count: queue.returnsPending, tone: 'warning' },
        { label: 'Refunded orders', count: queue.refundedOrders, tone: 'neutral' },
      ],

      actionQueue: buildActionQueue(queue),
      integrations: integrationHealth(),
      recentSubOrders,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/dashboard-summary — the four counters the admin home shares with
// the seller and partner panels.
// ---------------------------------------------------------------------------
async function getDashboardSummary(req, res) {
  const today = resolveRange('7d');
  const startOfToday = new Date(today.end.getTime() - 24 * 60 * 60 * 1000);

  const [totalUsers, totalSellers, pendingApprovals, ordersToday] = await Promise.all([
    User.countDocuments({ role: 'customer', isDeleted: false }),
    Vendor.countDocuments({}),
    Vendor.countDocuments({ verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] } }),
    Order.countDocuments({ createdAt: { $gte: startOfToday, $lt: today.end } }),
  ]);

  res.json({ success: true, data: { totalUsers, totalSellers, pendingApprovals, ordersToday } });
}

// ---------------------------------------------------------------------------
// GET /admin/analytics/sales?range=7d|30d|90d|fy
// ---------------------------------------------------------------------------
async function getSalesAnalytics(req, res) {
  const range = resolveRange(req.query.range);
  const { buckets, indexByDay } = buildBuckets(range);

  const [facts, previousFacts, returnRefunds, previousReturnRefunds, modelRows, categoryRows] =
    await Promise.all([
      orderFacts(range.start, range.end).then(normaliseFacts),
      orderFacts(range.previous.start, range.previous.end).then(normaliseFacts),
      returnRefundsByDay(range.start, range.end),
      returnRefundsByDay(range.previous.start, range.previous.end),
      ordersByModel(range.start, range.end),
      categoryRevenue(range.start, range.end),
    ]);

  const refunds = facts.refunded + refundTotal(returnRefunds);
  const previousRefunds = previousFacts.refunded + refundTotal(previousReturnRefunds);
  const refundRate = rate(refunds, facts.captured);
  // A window that captured nothing has no rate to compare against — that is
  // an absent delta, not a jump from zero.
  const previousRefundRate = previousFacts.captured ? rate(previousRefunds, previousFacts.captured) : null;

  const aov = facts.orders ? facts.revenue / facts.orders : 0;
  const previousAov = previousFacts.orders ? previousFacts.revenue / previousFacts.orders : 0;

  // Cancellation refunds are dated by when the order was placed, return
  // refunds by when they were approved. Both land in the same series.
  const refundRows = [
    ...facts.byDay.map((row) => ({ day: row.day, refunds: row.refunds })),
    ...returnRefunds.map((row) => ({ day: row._id, refunds: row.refunds })),
  ];

  const revenueSeries = toSeries(buckets, indexByDay, facts.byDay, ['revenue']);
  const refundSeries = toSeries(buckets, indexByDay, refundRows, ['refunds']);

  res.json({
    success: true,
    data: {
      updatedAt: new Date().toISOString(),
      range: range.id,
      rangeLabel: range.label,
      granularity: range.granularity,

      kpis: [
        {
          key: 'revenue',
          label: 'Net revenue',
          value: toPaise(facts.revenue),
          format: 'money',
          delta: delta(facts.revenue, previousFacts.revenue),
          caption: 'net of cancellations',
        },
        {
          key: 'orders',
          label: 'Orders',
          value: facts.orders,
          format: 'count',
          delta: delta(facts.orders, previousFacts.orders),
          caption: `${count(facts.cancelled)} cancelled in this window`,
        },
        {
          key: 'aov',
          label: 'Average order value',
          value: toPaise(aov),
          format: 'money',
          delta: delta(aov, previousAov),
          caption: `${count(facts.units)} units sold`,
        },
        {
          key: 'refundRate',
          label: 'Refund rate',
          value: refundRate,
          format: 'percent',
          delta: pointDelta(refundRate, previousRefundRate, { lowerIsBetter: true }),
          caption: 'of captured value',
        },
      ],

      revenueTrend: revenueSeries.map((point, index) => ({
        label: point.label,
        revenue: toPaise(point.revenue),
        refunds: toPaise(refundSeries[index].refunds),
      })),

      ordersByModel: MODEL_ORDER.map((model) => ({
        label: BUSINESS_MODEL_LABELS[model],
        value: modelRows.find((row) => row._id === model)?.value || 0,
      })).filter((slice) => slice.value > 0),

      topCategories: categoryRows.map((row) => ({
        label: row.label,
        revenue: toPaise(row.revenue),
        orders: row.orders,
      })),

      paymentMix: facts.byPaymentMethod
        .map((row) => ({ label: PAYMENT_METHOD_LABELS[row._id] || row._id, value: row.count }))
        .sort((left, right) => right.value - left.value),
    },
  });
}

module.exports = { getDashboard, getDashboardSummary, getSalesAnalytics };
