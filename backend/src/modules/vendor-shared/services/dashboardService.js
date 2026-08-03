// Layer rule: services/ is the ONLY place that imports a model directly.
// One function per use case, no req/res here — controllers/ call these.
import { Seller, SubOrder } from '../../../models/index.js'
import { ORDER_STATUS } from '../../../config/constants.js'
import { ApiError } from '../../../lib/ApiError.js'

export async function getVendorDashboardSummary(userId) {
  const seller = await Seller.findOne({ user: userId }).lean()
  if (!seller) {
    throw ApiError.notFound('No seller/partner profile is linked to this account yet.')
  }

  const [totalOrders, pendingOrders, revenueAgg, pendingSettlementAgg] = await Promise.all([
    SubOrder.countDocuments({ vendor: seller._id }),
    SubOrder.countDocuments({
      vendor: seller._id,
      status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.SETTLEMENT_ELIGIBLE, ORDER_STATUS.SETTLED] },
    }),
    SubOrder.aggregate([
      { $match: { vendor: seller._id } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    SubOrder.aggregate([
      { $match: { vendor: seller._id, status: ORDER_STATUS.SETTLEMENT_ELIGIBLE } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$totalAmount', '$commissionSnapshot'] } } } },
    ]),
  ])

  return {
    vendorName: seller.storeName,
    status: seller.status,
    totalOrders,
    pendingOrders,
    totalRevenue: revenueAgg[0]?.total ?? 0,
    pendingSettlement: pendingSettlementAgg[0]?.total ?? 0,
  }
}
