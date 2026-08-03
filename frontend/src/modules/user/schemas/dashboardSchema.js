import { z } from 'zod'

// Runtime contract for GET /users/me/dashboard-summary.
export const userDashboardSummarySchema = z.object({
  displayName: z.string(),
  activeOrders: z.number(),
  wishlistCount: z.number(),
  addressCount: z.number(),
})
