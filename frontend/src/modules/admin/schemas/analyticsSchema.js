import { z } from 'zod'

// Runtime contract for the four analytics endpoints. Money is in PAISE.

const point = z.object({ label: z.string() }).catchall(z.number())

const kpi = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  format: z.enum(['money', 'count', 'percent', 'ratio']),
  delta: z.object({ direction: z.enum(['up', 'down', 'flat']), label: z.string() }).nullable(),
  caption: z.string(),
})

const slice = z.object({ label: z.string(), value: z.number() })

export const salesAnalyticsSchema = z.object({
  kpis: z.array(kpi),
  revenueTrend: z.array(point),
  ordersByModel: z.array(slice),
  topCategories: z.array(z.object({ label: z.string(), revenue: z.number(), orders: z.number() })),
  paymentMix: z.array(slice),
})

export const vendorAnalyticsSchema = z.object({
  kpis: z.array(kpi),
  fulfilmentSpeed: z.array(point),
  vendors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      model: z.string(),
      orders: z.number(),
      revenue: z.number(),
      acceptanceRate: z.number(),
      avgDispatchHours: z.number(),
      rtoRate: z.number(),
      rating: z.number(),
    }),
  ),
})

export const catalogAnalyticsSchema = z.object({
  kpis: z.array(kpi),
  categoryRevenue: z.array(z.object({ label: z.string(), revenue: z.number() })),
  topProducts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sku: z.string(),
      units: z.number(),
      revenue: z.number(),
      returnRate: z.number(),
    }),
  ),
  stockRisk: z.array(
    z.object({ id: z.string(), name: z.string(), sku: z.string(), onHand: z.number(), daysCover: z.number() }),
  ),
})

export const customerAnalyticsSchema = z.object({
  kpis: z.array(kpi),
  acquisition: z.array(point),
  buyerMix: z.array(slice),
  topCities: z.array(z.object({ label: z.string(), orders: z.number(), revenue: z.number() })),
})
