// Layer rule: services/ is the ONLY place that imports a model directly.
import { User, Seller, Order } from '../../../models/index.js'

export async function getAdminDashboardSummary() {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [totalUsers, totalSellers, pendingApprovals, ordersToday] = await Promise.all([
    User.countDocuments(),
    Seller.countDocuments(),
    Seller.countDocuments({ status: 'pending_approval' }),
    Order.countDocuments({ createdAt: { $gte: startOfToday } }),
  ])

  return { totalUsers, totalSellers, pendingApprovals, ordersToday }
}
