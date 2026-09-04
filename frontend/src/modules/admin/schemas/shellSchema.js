import { z } from 'zod'

// Runtime contract for GET /admin/shell-summary — the counters the sidebar
// badges read and the notification tray. One request, because these are on
// every screen and must not become nine.
export const shellSummarySchema = z.object({
  counts: z.object({
    productApprovals: z.number(),
    openReturns: z.number(),
    pendingKyc: z.number(),
    failedPayouts: z.number(),
  }),
  notifications: z.array(
    z.object({
      id: z.string(),
      tone: z.enum(['brand', 'success', 'warning', 'danger']),
      title: z.string(),
      body: z.string(),
      at: z.string(),
      to: z.string(),
      read: z.boolean(),
    }),
  ),
})
