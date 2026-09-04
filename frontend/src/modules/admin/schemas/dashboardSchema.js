import { z } from 'zod'
import { BUSINESS_MODEL } from '../../../config/constants'
import { INTEGRATION_HEALTH } from '../constants'

// Runtime contract for GET /admin/dashboard-summary.
// Money is in PAISE, integer, throughout.

export const adminDashboardSummarySchema = z.object({
  totalUsers: z.number(),
  totalSellers: z.number(),
  pendingApprovals: z.number(),
  ordersToday: z.number(),
})

const deltaSchema = z.object({
  direction: z.enum(['up', 'down', 'flat']),
  label: z.string(),
})

export const dashboardSchema = z.object({
  updatedAt: z.string(),

  kpis: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number(),
      format: z.enum(['money', 'count']),
      delta: deltaSchema.nullable(),
      caption: z.string(),
      tone: z.enum(['default', 'brand']).optional(),
      trend: z.array(z.object({ value: z.number() })).optional(),
    }),
  ),

  // One row per month; one key per business model. Stacked in fixed order so
  // a model keeps its colour regardless of how many are on screen.
  revenueByModel: z.array(
    z.object({
      label: z.string(),
      [BUSINESS_MODEL.MARKETPLACE]: z.number(),
      [BUSINESS_MODEL.DROPSHIPPING]: z.number(),
      [BUSINESS_MODEL.OWN_STOCK]: z.number(),
    }),
  ),

  pipeline: z.array(
    z.object({ status: z.string(), label: z.string(), count: z.number() }),
  ),

  exceptions: z.array(
    z.object({
      label: z.string(),
      count: z.number(),
      tone: z.enum(['neutral', 'warning', 'danger']),
    }),
  ),

  actionQueue: z.array(
    z.object({
      id: z.string(),
      icon: z.string(),
      tone: z.enum(['brand', 'warning', 'danger']),
      title: z.string(),
      subtitle: z.string(),
      count: z.number(),
      to: z.string(),
    }),
  ),

  integrations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(Object.values(INTEGRATION_HEALTH)),
      note: z.string().nullable(),
    }),
  ),

  recentSubOrders: z.array(
    z.object({
      id: z.string(),
      orderId: z.string(),
      seller: z.string(),
      model: z.enum([
        BUSINESS_MODEL.MARKETPLACE,
        BUSINESS_MODEL.DROPSHIPPING,
        BUSINESS_MODEL.OWN_STOCK,
      ]),
      status: z.string(),
      total: z.number(),
    }),
  ),
})
