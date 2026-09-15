const Order = require('../Models/Order');
const Product = require('../Models/Product');
const { toPaise } = require('../utils/money');

// GET /vendor/summary — powers the dashboard KPI row (see
// frontend vendor-shared/schemas/vendorSchema.js vendorSummarySchema).
async function getMySummary(req, res) {
  const vendor = req.vendor;
  const vendorId = vendor._id;

  const [orderRows, liveSkusCount] = await Promise.all([
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.vendor': vendorId } },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$items.status', 'DELIVERED'] }, { $multiply: ['$items.price', '$items.quantity'] }, 0],
            },
          },
          pendingOrdersCount: {
            $sum: { $cond: [{ $in: ['$items.status', ['PENDING', 'PROCESSING']] }, 1, 0] },
          },
        },
      },
    ]),
    Product.countDocuments({ vendor: vendorId, isActive: true, approvalStatus: 'APPROVED' }),
  ]);

  const commissionRate = vendor.commissionRatePercent ?? 10;
  const totalRevenue = orderRows[0]?.totalRevenue || 0;
  const availablePayout = Math.round(totalRevenue * (1 - commissionRate / 100));

  res.json({
    success: true,
    data: {
      storeName: vendor.business?.businessName || vendor.name,
      status: vendor.verificationStatus.toLowerCase(),
      totalRevenue: toPaise(totalRevenue),
      pendingOrdersCount: orderRows[0]?.pendingOrdersCount || 0,
      liveSkusCount,
      availablePayout: toPaise(availablePayout),
      kycStatus: vendor.verificationStatus.toLowerCase() === 'approved' ? 'approved' : 'pending',
      routeLinked: Boolean(vendor.bank?.accountNumber),
    },
  });
}

module.exports = { getMySummary };
