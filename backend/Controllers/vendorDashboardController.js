const Order = require('../Models/Order');
const Product = require('../Models/Product');
const Settlement = require('../Models/Settlement');
const { toPaise } = require('../utils/money');

// Same three-bucket split the Earnings screen uses — see the header on
// vendorEarningsController. The dashboard tile only needs the owed figure, but
// it has to be the SAME owed figure, so it is read off Settlement rather than
// re-derived from a flat commission rate.
const PAID = Settlement.PAID_STATUSES;
const IN_FLIGHT = Settlement.CLAIMING_STATUSES.filter((s) => !PAID.includes(s));

function netPaiseOf(settlement) {
  const mirror = settlement.netPayablePaise;
  if (typeof mirror === 'number' && mirror !== 0) return mirror;
  return toPaise(settlement.netAmount || 0);
}

// GET /vendor/summary — powers the dashboard KPI row (see
// frontend vendor-shared/schemas/vendorSchema.js vendorSummarySchema).
async function getMySummary(req, res) {
  const vendor = req.vendor;
  const vendorId = vendor._id;

  const [orderRows, liveSkusCount, settlements] = await Promise.all([
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
    Settlement.find({ vendor: vendorId }).select('status netPayablePaise netAmount').lean(),
  ]);

  const totalRevenue = orderRows[0]?.totalRevenue || 0;

  // What is actually owed: batched-but-unpaid. Deliberately NOT
  // revenue-minus-a-flat-commission, which is what this used to show and which
  // disagreed with both the Earnings screen and the amount admin pays.
  const availablePayoutPaise = settlements
    .filter((s) => IN_FLIGHT.includes(s.status))
    .reduce((sum, s) => sum + netPaiseOf(s), 0);

  res.json({
    success: true,
    data: {
      storeName: vendor.business?.businessName || vendor.name,
      status: vendor.verificationStatus.toLowerCase(),
      totalRevenue: toPaise(totalRevenue),
      pendingOrdersCount: orderRows[0]?.pendingOrdersCount || 0,
      liveSkusCount,
      availablePayout: availablePayoutPaise,
      kycStatus: vendor.verificationStatus.toLowerCase() === 'approved' ? 'approved' : 'pending',
      routeLinked: Boolean(vendor.bank?.accountNumber),
    },
  });
}

module.exports = { getMySummary };
