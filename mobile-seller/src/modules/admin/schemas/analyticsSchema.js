import { z } from 'zod'
import { granularitySchema } from './dashboardSchema'

// Runtime contract for the seller revenue endpoint (the only analytics schema the seller app
// imports). Money is in PAISE.

const point = z.object({ label: z.string() }).catchall(z.number())

const kpi = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  format: z.enum(['money', 'count', 'percent', 'ratio']),
  delta: z
    .object({
      direction: z.enum(['up', 'down', 'flat']),
      label: z.string(),
      // The arrow follows the movement, the colour follows the sentiment.
      sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    })
    .nullable(),
  caption: z.string(),
})

const windowMeta = {
  updatedAt: z.string().optional(),
  range: z.string().optional(),
  rangeLabel: z.string().optional(),
  granularity: granularitySchema.optional(),
}

const revenueFigures = {
  orders: z.number(),
  units: z.number(),
  sales: z.number(),
  refunds: z.number(),
  netSales: z.number(),
  inProgressSales: z.number(),
  commission: z.number(),
  cost: z.number(),
  earnings: z.number(),
  sellerEarnings: z.number(),
  linesWithoutCost: z.number(),
}

export const sellerRevenueSchema = z.object({
  ...windowMeta,
  seller: z.object({ id: z.string(), name: z.string(), vendorType: z.string().optional() }),
  kpis: z.array(kpi),
  totals: z.object(revenueFigures),
  trend: z.array(point),
  products: z.array(z.object({ id: z.string(), name: z.string(), ...revenueFigures })),
})
