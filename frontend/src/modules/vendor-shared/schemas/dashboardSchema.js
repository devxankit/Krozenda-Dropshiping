import { z } from 'zod'

// Runtime contract for GET /vendor/dashboard-summary. Parsing this at the
// service boundary means a controller/page can trust `summary` shape
// without re-checking it — a bad response fails loudly in services/, not
// silently in the UI.
export const vendorDashboardSummarySchema = z.object({
  vendorName: z.string(),
  status: z.string(),
  totalOrders: z.number(),
  pendingOrders: z.number(),
  totalRevenue: z.number(),
  pendingSettlement: z.number(),
})
