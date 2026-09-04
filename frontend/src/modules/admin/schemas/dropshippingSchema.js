import { z } from 'zod'
import { REVIEW_STATUS } from '../constants'

// Runtime contract for dropshipping endpoints. Money is in PAISE.

const reviewStatus = z.enum(Object.values(REVIEW_STATUS))

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

export const dropshipOverviewSchema = z.object({
  activePartners: z.number().int(),
  pendingPartners: z.number().int(),
  liveSkus: z.number().int(),
  forwardedOrdersToday: z.number().int(),
  grossSalesToday: z.number().int(),
  platformMarginToday: z.number().int(),
  autoForwardSuccessRate: z.number(),
  syncHealth: z.string(),
  recentOrders: z.array(
    z.object({
      subOrderId: z.string(),
      parentOrderId: z.string(),
      partnerName: z.string(),
      productName: z.string(),
      qty: z.number().int(),
      amount: z.number().int(),
      commission: z.number().int(),
      status: z.string(),
      forwardedAt: z.string(),
    }),
  ),
})

export const dropshipPartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  supplierType: z.string(),
  city: z.string(),
  gstin: z.string().nullable(),
  integrationMode: z.string(),
  products: z.number().int(),
  ordersCount: z.number().int(),
  revenue: z.number().int(),
  kycStatus: reviewStatus,
  routeLinked: z.boolean(),
  autoForward: z.boolean(),
  joinedAt: z.string(),
  status: z.enum(['active', 'pending', 'suspended']),
})

export const dropshipPartnerListSchema = paged(dropshipPartnerSchema)

export const dropshipProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  partnerName: z.string(),
  category: z.string(),
  costPrice: z.number().int(),
  sellingPrice: z.number().int(),
  marginPct: z.number(),
  supplierStock: z.number().int(),
  syncStatus: z.enum(['operational', 'pending', 'sync_error']),
  lastSyncAt: z.string(),
  overrideActive: z.boolean(),
})

export const dropshipProductListSchema = paged(dropshipProductSchema)

export const forwardedOrderSchema = z.object({
  id: z.string(),
  parentOrderId: z.string(),
  customerName: z.string(),
  partnerName: z.string(),
  productName: z.string(),
  quantity: z.number().int(),
  orderValue: z.number().int(),
  commissionAmount: z.number().int(),
  supplierPayable: z.number().int(),
  forwardingStatus: z.string(),
  awb: z.string().nullable(),
  placedAt: z.string(),
})

export const forwardedOrderListSchema = paged(forwardedOrderSchema)

export const marginRuleSchema = z.object({
  id: z.string(),
  ruleName: z.string(),
  scope: z.enum(['product', 'vendor', 'category', 'company', 'default']),
  targetName: z.string(),
  commissionType: z.enum(['percentage', 'fixed']),
  value: z.number(),
  manualOverrideAllowed: z.boolean(),
  status: z.enum(['active', 'inactive']),
})

export const marginRuleListSchema = z.array(marginRuleSchema)
