// Layer rule: services/ is the ONLY place that imports a model directly.
import { User, Order } from '../../../models/index.js'
import { ApiError } from '../../../lib/ApiError.js'

export async function getUserDashboardSummary(userId) {
  const user = await User.findById(userId).lean()
  if (!user) {
    throw ApiError.notFound('User not found.')
  }

  const activeOrders = await Order.countDocuments({ buyer: userId })

  return {
    displayName: user.name,
    activeOrders,
    // Wishlist and address book are not modelled in this scaffold — add
    // those collections and wire real counts in when those features land.
    wishlistCount: 0,
    addressCount: 0,
  }
}
