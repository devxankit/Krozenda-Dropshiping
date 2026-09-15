const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { toPaise } = require('../utils/money');

async function getMyAnalytics(req, res) {
  const vendorId = req.vendor._id;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [salesByDay, topProducts, statusBreakdown, productStats] = await Promise.all([
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          unitsSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      { $group: { _id: '$items.status', count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: { vendor: vendorId } },
      { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      salesTrend: salesByDay.map((d) => ({ date: d._id, revenue: toPaise(d.revenue), orders: d.orders })),
      topProducts: topProducts.map((p) => ({
        productId: p._id.toString(),
        name: p.name,
        unitsSold: p.unitsSold,
        revenue: toPaise(p.revenue),
      })),
      orderStatusBreakdown: Object.fromEntries(statusBreakdown.map((s) => [s._id, s.count])),
      productsTotal: productStats[0]?.total || 0,
      productsActive: productStats[0]?.active || 0,
    },
  });
}

module.exports = { getMyAnalytics };
