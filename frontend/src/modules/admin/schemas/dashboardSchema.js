import { z } from 'zod'

// Runtime contract for GET /admin/dashboard-summary.
export const adminDashboardSummarySchema = z.object({
  totalUsers: z.number(),
  totalSellers: z.number(),
  pendingApprovals: z.number(),
  ordersToday: z.number(),
})
