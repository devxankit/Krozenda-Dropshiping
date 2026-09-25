const mongoose = require('mongoose');
const Vendor = require('../Models/Vendor');
const { computeRevenue } = require('../services/revenueService');
const { USD_TO_INR_RATE } = require('../services/cj/cjPricing');
const { resolveRange } = require('../utils/analyticsRange');
const { delta } = require('./adminAnalyticsController');

// GET /admin/analytics/revenue              — platform-wide, by channel and seller
// GET /admin/analytics/revenue/sellers/:id  — one seller, as admin sees them
// GET /vendor/revenue                       — the signed-in seller's own
//
// All three read services/revenueService, so the figure an admin sees for a
// seller is exactly the figure that seller sees for themselves. Money leaves
// in PAISE, like every other analytics endpoint.

function kpi(key, label, value, previous, caption, { format = 'money', lowerIsBetter = false } = {}) {
  return { key, label, value, format, delta: delta(value, previous, { lowerIsBetter }), caption };
}

function windowMeta(range) {
  return {
    updatedAt: new Date().toISOString(),
    range: range.id,
    rangeLabel: range.label,
    granularity: range.granularity,
  };
}

// Each channel on its own, for the Revenue screen's channel switcher. What
// Krozenda keeps is worked out differently per channel, so each gets its own
// four figures rather than one generic set.
function channelKpis(current, previous) {
  const pick = (list, key) => list.find((c) => c.key === key) || {};
  const out = {};
  for (const channel of current) {
    const c = channel;
    const p = pick(previous, channel.key);
    const orders = kpi('orders', 'Orders', c.orders, p.orders, `${channel.label} orders placed`, { format: 'count' });
    const net = kpi('netSales', 'Net sales', c.netSales, p.netSales, 'After refunds, before shipping');
    if (channel.key === 'sellers') {
      out[channel.key] = [
        net,
        kpi('commission', 'Krozenda commission', c.commission, p.commission, 'What Krozenda keeps'),
        kpi('sellerEarnings', 'Seller earnings', c.sellerEarnings, p.sellerEarnings, "Sellers' share after commission"),
        orders,
      ];
    } else if (channel.key === 'cj') {
      out[channel.key] = [
        net,
        kpi('cost', 'CJ cost', c.cost, p.cost, `Charged by CJ, at ₹${USD_TO_INR_RATE}/USD`, { lowerIsBetter: true }),
        kpi('earnings', 'Krozenda margin', c.earnings, p.earnings, 'Net sales − CJ cost'),
        orders,
      ];
    } else {
      out[channel.key] = [
        net,
        kpi('cost', 'Product cost', c.cost, p.cost, "From each product's cost price", { lowerIsBetter: true }),
        kpi('earnings', 'Krozenda profit', c.earnings, p.earnings, 'Net sales − product cost'),
        orders,
      ];
    }
  }
  return out;
}

async function getAdminRevenue(req, res) {
  const range = resolveRange(req.query.range);
  const [current, previous] = await Promise.all([
    computeRevenue({ start: range.start, end: range.end, range }),
    computeRevenue({ start: range.previous.start, end: range.previous.end }),
  ]);
  const t = current.totals;
  const p = previous.totals;

  res.json({
    success: true,
    data: {
      ...windowMeta(range),
      kpis: [
        kpi('netSales', 'Total sales', t.netSales, p.netSales, 'All channels, after refunds, before shipping'),
        kpi(
          'earnings',
          'Krozenda earnings',
          t.earnings,
          p.earnings,
          'Own-stock profit + CJ margin + seller commission'
        ),
        kpi('sellerEarnings', 'Seller earnings', t.sellerEarnings, p.sellerEarnings, "Sellers' share after commission"),
        kpi('refunds', 'Refunds', t.refunds, p.refunds, 'Approved return refunds', { lowerIsBetter: true }),
      ],
      channelKpis: channelKpis(current.channels, previous.channels),
      totals: t,
      channels: current.channels,
      trend: current.trend,
      sellers: current.sellers,
      notes: {
        cjUsdToInrRate: USD_TO_INR_RATE,
        ownStockLinesWithoutCost: current.channels.find((c) => c.key === 'own_stock')?.linesWithoutCost || 0,
      },
    },
  });
}

// The one-seller view both sides render.
async function sellerRevenue(vendor, range, { self = false } = {}) {
  const [current, previous] = await Promise.all([
    computeRevenue({ start: range.start, end: range.end, range, vendorId: vendor._id }),
    computeRevenue({ start: range.previous.start, end: range.previous.end, vendorId: vendor._id }),
  ]);
  const t = current.totals;
  const p = previous.totals;

  return {
    ...windowMeta(range),
    seller: {
      id: String(vendor._id),
      name: vendor.business?.businessName || vendor.name,
      vendorType: vendor.vendorType,
    },
    kpis: [
      kpi('netSales', 'Net sales', t.netSales, p.netSales, 'What buyers paid, after refunds'),
      kpi('commission', 'Commission', t.commission, p.commission, 'Krozenda commission on these sales', {
        lowerIsBetter: true,
      }),
      kpi(
        'sellerEarnings',
        self ? 'Your earnings' : 'Seller earnings',
        t.sellerEarnings,
        p.sellerEarnings,
        'Net sales minus commission'
      ),
      kpi('orders', 'Orders', t.orders, p.orders, 'Orders with at least one live line', { format: 'count' }),
    ],
    totals: t,
    trend: current.trend.map((point) => ({ label: point.label, netSales: point.sellers })),
    products: current.products,
  };
}

async function getAdminSellerRevenue(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid seller id' });
  }
  const vendor = await Vendor.findById(req.params.id).select('name business.businessName vendorType').lean();
  if (!vendor) return res.status(404).json({ success: false, message: 'Seller not found' });

  res.json({ success: true, data: await sellerRevenue(vendor, resolveRange(req.query.range)) });
}

async function getMyRevenue(req, res) {
  res.json({ success: true, data: await sellerRevenue(req.vendor, resolveRange(req.query.range), { self: true }) });
}

module.exports = { getAdminRevenue, getAdminSellerRevenue, getMyRevenue };
