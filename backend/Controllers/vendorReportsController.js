const Order = require('../Models/Order');
const { toPaise } = require('../utils/money');

// Vendor > Reports. A date-range operational report over this seller's own
// order lines — distinct from Analytics (a fixed last-30-days dashboard) and
// from Earnings (settlement/payout ledger): this is "what sold, when, and
// how much" for whatever window the seller picks, plus a CSV they can take
// to their own books.

function dateRangeParam(query) {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime())) {
    // Inclusive of the whole "to" day.
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return { from: start, to: now };
}

async function buildReport(vendorId, range) {
  const [dailySales, productPerformance, statusBreakdown] = await Promise.all([
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId, createdAt: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          units: { $sum: '$items.quantity' },
          orders: { $addToSet: '$_id' },
        },
      },
      { $project: { revenue: 1, units: 1, orders: { $size: '$orders' } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId, createdAt: { $gte: range.from, $lte: range.to } } },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 20 },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId, createdAt: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$items.status', count: { $sum: 1 } } },
    ]),
  ]);

  const totalRevenuePaise = dailySales.reduce((sum, d) => sum + toPaise(d.revenue), 0);
  const totalOrders = dailySales.reduce((sum, d) => sum + d.orders, 0);
  const totalUnits = dailySales.reduce((sum, d) => sum + d.units, 0);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      revenue: totalRevenuePaise,
      orders: totalOrders,
      units: totalUnits,
      // Integer paise divide, so a zero-order window reports 0 rather than NaN.
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenuePaise / totalOrders) : 0,
    },
    dailySales: dailySales.map((d) => ({
      date: d._id,
      revenue: toPaise(d.revenue),
      orders: d.orders,
      units: d.units,
    })),
    productPerformance: productPerformance.map((p) => ({
      productId: p._id ? p._id.toString() : null,
      name: p.name,
      unitsSold: p.unitsSold,
      revenue: toPaise(p.revenue),
    })),
    orderStatusBreakdown: Object.fromEntries(statusBreakdown.map((s) => [s._id, s.count])),
  };
}

async function getSalesReport(req, res) {
  const range = dateRangeParam(req.query);
  const data = await buildReport(req.vendor._id, range);
  res.json({ success: true, data });
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function exportSalesReportCsv(req, res) {
  const range = dateRangeParam(req.query);
  const data = await buildReport(req.vendor._id, range);

  const rows = [['Date', 'Orders', 'Units', 'Revenue (INR)']];
  for (const d of data.dailySales) {
    rows.push([d.date, d.orders, d.units, (d.revenue / 100).toFixed(2)]);
  }
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="sales-report-${data.range.from.slice(0, 10)}-to-${data.range.to.slice(0, 10)}.csv"`);
  res.send(csv);
}

module.exports = { getSalesReport, exportSalesReportCsv };
