const mongoose = require('mongoose');
const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Vendor = require('../Models/Vendor');

// Admin > Marketing > Reports (task §21 follow-on).
//
// This is a distinct surface from /admin/accounting/reports: that module
// runs ledger/settlement reports for finance, this one is the general
// operational report catalogue linked off Marketing. Only the catalogue
// METADATA below (name/description/grouping) is fixed — every row a report
// returns comes from a real aggregation over Order/Product/Vendor, the same
// collections the rest of the admin panel reads. A report with no
// aggregation wired up yet is left out of the catalogue rather than
// returning fabricated rows.

function column(key, label, align) {
  return align ? { key, label, align } : { key, label };
}

function dateRangeParam(query) {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && !Number.isNaN(from.getTime()) && to && !Number.isNaN(to.getTime())) {
    return { from, to };
  }
  // Default window: last 30 days, so a first open of the report is never an
  // expensive full-table scan.
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  return { from: start, to: now };
}

function periodParameter(range) {
  return {
    key: 'period',
    label: 'Period',
    type: 'date-range',
    value: `${range.from.toISOString().slice(0, 10)} – ${range.to.toISOString().slice(0, 10)}`,
  };
}

// ---------------------------------------------------------------------------
// Sales summary — orders, units, revenue and AOV by day
// ---------------------------------------------------------------------------

async function salesSummary({ range }) {
  const match = {
    createdAt: { $gte: range.from, $lte: range.to },
    $or: [{ paymentStatus: { $in: ['PAID', 'REFUNDED'] } }, { paymentMethod: 'COD', codRemittedAt: { $ne: null } }],
  };

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        units: { $sum: { $sum: '$items.quantity' } },
        revenue: { $sum: '$total' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const mapped = rows.map((row) => ({
    date: row._id,
    orders: row.orders,
    units: row.units,
    revenue: row.revenue,
    aov: row.orders > 0 ? Math.round(row.revenue / row.orders) : 0,
  }));

  return {
    columns: [
      column('date', 'Date'),
      column('orders', 'Orders', 'right'),
      column('units', 'Units', 'right'),
      column('revenue', 'Revenue', 'right'),
      column('aov', 'Average order value', 'right'),
    ],
    rows: mapped,
    parameters: [periodParameter(range)],
  };
}

// ---------------------------------------------------------------------------
// Inventory ageing — current stock levels, flagged for slow/zero cover
// ---------------------------------------------------------------------------

async function inventoryAgeing() {
  const products = await Product.find({ isActive: true })
    .select('name sku stock category updatedAt')
    .populate('category', 'name')
    .sort({ stock: 1 })
    .limit(500)
    .lean();

  const rows = products.map((product) => ({
    product: product.name,
    sku: product.sku || '—',
    category: product.category?.name || 'Uncategorised',
    stock: product.stock,
    status: product.stock === 0 ? 'Out of stock' : product.stock < 10 ? 'Low stock' : 'In stock',
    updatedAt: product.updatedAt,
  }));

  return {
    columns: [
      column('product', 'Product'),
      column('sku', 'SKU'),
      column('category', 'Category'),
      column('stock', 'Stock on hand', 'right'),
      column('status', 'Status'),
      column('updatedAt', 'Last updated'),
    ],
    rows,
    parameters: [],
  };
}

// ---------------------------------------------------------------------------
// Vendor performance — orders, revenue and RTO/cancellation rate by seller
// ---------------------------------------------------------------------------

async function vendorPerformance({ range }) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
    { $unwind: '$items' },
    { $match: { 'items.vendor': { $ne: null } } },
    {
      $group: {
        _id: '$items.vendor',
        orders: { $addToSet: '$_id' },
        units: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$items.status', 'CANCELLED'] }, 1, 0] } },
        lines: { $sum: 1 },
      },
    },
  ]);

  const vendors = await Vendor.find({ _id: { $in: rows.map((row) => row._id) } })
    .select('name business.businessName')
    .lean();
  const vendorById = new Map(vendors.map((vendor) => [String(vendor._id), vendor]));

  const mapped = rows
    .map((row) => ({
      seller: vendorById.get(String(row._id))?.business?.businessName || vendorById.get(String(row._id))?.name || 'Unknown seller',
      orders: row.orders.length,
      units: row.units,
      revenue: row.revenue,
      cancellationRate: row.lines > 0 ? Number(((row.cancelled / row.lines) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    columns: [
      column('seller', 'Seller'),
      column('orders', 'Orders', 'right'),
      column('units', 'Units', 'right'),
      column('revenue', 'Revenue', 'right'),
      column('cancellationRate', 'Cancellation rate %', 'right'),
    ],
    rows: mapped,
    parameters: [periodParameter(range)],
  };
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const REPORTS = Object.freeze({
  'sales-summary': {
    name: 'Sales summary',
    description: 'Orders, revenue and average order value by day',
    group: 'Sales',
    run: salesSummary,
  },
  'inventory-ageing': {
    name: 'Inventory levels',
    description: 'Current stock on hand by product, flagged for low/zero cover',
    group: 'Operations',
    run: inventoryAgeing,
  },
  'vendor-performance': {
    name: 'Vendor performance',
    description: 'Orders, revenue and cancellation rate by seller',
    group: 'Operations',
    run: vendorPerformance,
  },
});

async function listReports(req, res) {
  const groups = new Map();
  for (const [key, report] of Object.entries(REPORTS)) {
    if (!groups.has(report.group)) groups.set(report.group, []);
    groups.get(report.group).push({
      key,
      name: report.name,
      description: report.description,
      formats: ['CSV'],
      lastRunAt: null,
    });
  }

  res.json({
    success: true,
    message: 'Reports fetched successfully',
    data: { groups: Array.from(groups, ([label, reports]) => ({ label, reports })) },
  });
}

async function runReport(req, res) {
  const { reportKey } = req.params;
  const report = REPORTS[reportKey];
  if (!report) {
    return res.status(404).json({ success: false, message: 'Unknown report' });
  }

  const range = dateRangeParam(req.query);
  const { columns, rows, parameters } = await report.run({ range });

  res.json({
    success: true,
    message: 'Report fetched successfully',
    data: {
      key: reportKey,
      name: report.name,
      description: report.description,
      formats: ['CSV'],
      parameters,
      columns,
      rows,
      rowCount: rows.length,
    },
  });
}

module.exports = { listReports, runReport, REPORTS };
