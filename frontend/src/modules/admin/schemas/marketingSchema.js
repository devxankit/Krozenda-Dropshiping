import { z } from 'zod'

// Runtime contract for the marketing, content and report endpoints.
// Money is in PAISE.

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

export const couponSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.number(), // paise when FIXED, a plain percent when PERCENTAGE — see backend serializeCoupon
  maxDiscountAmount: z.number().int().nullable(),
  minOrderAmount: z.number().int(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  usageLimit: z.number().int().nullable(),
  usedCount: z.number().int(),
  perUserLimit: z.number().int().nullable(),
  applicableTo: z.enum(['ALL', 'PRODUCTS', 'CATEGORIES', 'VENDORS']),
  productIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  vendorIds: z.array(z.string()),
  customerEligibility: z.enum(['ALL', 'NEW', 'EXISTING', 'SPECIFIC']),
  customerIds: z.array(z.string()),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean(),
  status: z.enum(['INACTIVE', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'USAGE_LIMIT_REACHED']),
  createdAt: z.string(),
})

export const couponListSchema = paged(couponSchema)

export const bannerWriteSchema = z.object({
  title: z.string().min(2, 'Give the banner a title'),
  productId: z.string().nullable().optional(),
  productName: z.string().optional(),
  status: z.string().optional(),
  placement: z.enum(['hero', 'promo', 'strip']).optional(),
  subtitle: z.string().optional(),
  tag: z.string().optional(),
  icon: z.string().optional(),
  theme: z.string().optional(),
  ctaPath: z.string().optional(),
})

export const campaignListSchema = paged(
  z.object({
    id: z.string(),
    name: z.string(),
    channel: z.enum(['push', 'sms', 'email']),
    audience: z.string(),
    audienceSize: z.number().int(),
    sentAt: z.string().nullable(),
    status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']),
    delivered: z.number().int(),
    opened: z.number().int(),
  }),
)

export const reviewListSchema = paged(
  z.object({
    id: z.string(),
    productId: z.string(),
    product: z.string(),
    sku: z.string(),
    productType: z.enum(['admin', 'vendor', 'dropship']),
    buyer: z.string(),
    rating: z.number().int().min(1).max(5),
    title: z.string(),
    body: z.string(),
    submittedAt: z.string(),
    verifiedPurchase: z.boolean(),
    status: z.enum(['pending', 'published', 'rejected']),
    flagged: z.boolean(),
  }),
)
