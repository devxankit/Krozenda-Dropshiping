import { z } from 'zod'
import { granularitySchema } from './dashboardSchema'

// Runtime contract for the four analytics endpoints. Money is in PAISE.

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
      // See dashboardSchema: the arrow follows the movement, the colour
      // follows the sentiment.
      sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
    })
    .nullable(),
  caption: z.string(),
})

const slice = z.object({ label: z.string(), value: z.number() })

// Present on every endpoint served by the live reporting API; absent from the
// fixtures that still stand in for the three unbuilt ones.
const windowMeta = {
  updatedAt: z.string().optional(),
  range: z.string().optional(),
  rangeLabel: z.string().optional(),
  granularity: granularitySchema.optional(),
}

export const salesAnalyticsSchema = z.object({
  ...windowMeta,
  kpis: z.array(kpi),
  revenueTrend: z.array(point),
  ordersByModel: z.array(slice),
  topCategories: z.array(z.object({ label: z.string(), revenue: z.number(), orders: z.number() })),
  paymentMix: z.array(slice),
})

export const vendorAnalyticsSchema = z.object({
  ...windowMeta,
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
  ...windowMeta,
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
  ...windowMeta,
  kpis: z.array(kpi),
  acquisition: z.array(point),
  buyerMix: z.array(slice),
  topCities: z.array(z.object({ label: z.string(), orders: z.number(), revenue: z.number() })),
})

// Revenue (Controllers/revenueController). Every figure block has the same
// shape, whether it is the whole platform, one channel, one seller or one
// product.
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

export const revenueSchema = z.object({
  ...windowMeta,
  kpis: z.array(kpi),
  channelKpis: z.record(z.string(), z.array(kpi)),
  totals: z.object({ ...revenueFigures, shippingFees: z.number() }),
  channels: z.array(z.object({ key: z.string(), label: z.string(), ...revenueFigures })),
  trend: z.array(point),
  sellers: z.array(z.object({ id: z.string(), name: z.string(), vendorType: z.string(), ...revenueFigures })),
  notes: z.object({ cjUsdToInrRate: z.number(), ownStockLinesWithoutCost: z.number() }),
})

export const sellerRevenueSchema = z.object({
  ...windowMeta,
  seller: z.object({ id: z.string(), name: z.string(), vendorType: z.string().optional() }),
  kpis: z.array(kpi),
  totals: z.object(revenueFigures),
  trend: z.array(point),
  products: z.array(z.object({ id: z.string(), name: z.string(), ...revenueFigures })),
})
