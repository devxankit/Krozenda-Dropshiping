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

export const offerListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      scope: z.string(),
      condition: z.string(),
      effect: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      active: z.boolean(),
      redemptions: z.number().int(),
    }),
  ),
})

export const bannerSchema = z.object({
  id: z.string(),
  title: z.string(),
  productId: z.string().nullable().optional(),
  productName: z.string().optional(),
  image: z.string().nullable().optional(),
  placement: z.enum(['hero', 'promo', 'strip']).optional(),
  subtitle: z.string().optional(),
  tag: z.string().optional(),
  icon: z.string().optional(),
  theme: z.string().optional(),
  ctaPath: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough()

export const bannerListSchema = z.object({
  items: z.array(bannerSchema),
  stats: z.record(z.string(), z.any()).optional(),
}).passthrough()

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

export const cmsPageSchema = z
  .object({
    id: z.string(),
    _id: z.string().optional(),
    title: z.string(),
    slug: z.string(),
    content: z.string().optional().default(''),
    version: z.string().optional().default('v1.0'),
    updatedAt: z.string().optional(),
    updatedBy: z.string().optional(),
    status: z.enum(['draft', 'published', 'archived']).default('published'),
    requiresAcceptance: z.boolean().default(false),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
  })
  .passthrough()

export const cmsPageListSchema = z
  .object({
    items: z.array(cmsPageSchema),
    stats: z.record(z.string(), z.any()).optional(),
  })
  .passthrough()

export const cmsPageWriteSchema = z.object({
  title: z.string().min(2, 'Page title is required'),
  slug: z.string().optional(),
  content: z.string().optional().default(''),
  version: z.string().optional().default('v1.0'),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  requiresAcceptance: z.boolean().default(false),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
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

export const templateListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      trigger: z.string(),
      channels: z.array(z.enum(['push', 'sms', 'email'])),
      // DLT applies to SMS only, and only in India. A template without an
      // approved DLT id cannot be sent at all.
      dltTemplateId: z.string().nullable(),
      dltStatus: z.enum(['approved', 'pending', 'rejected', 'not_required']),
      updatedAt: z.string(),
      active: z.boolean(),
    }),
  ),
})

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

export const reportCatalogueSchema = z.object({
  groups: z.array(
    z.object({
      label: z.string(),
      reports: z.array(
        z.object({
          key: z.string(),
          name: z.string(),
          description: z.string(),
          formats: z.array(z.string()),
          lastRunAt: z.string().nullable(),
        }),
      ),
    }),
  ),
})

export const reportRunSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  formats: z.array(z.string()),
  parameters: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(['date-range', 'select', 'multiselect']),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      value: z.string(),
    }),
  ),
  columns: z.array(z.object({ key: z.string(), label: z.string(), align: z.string().optional() })),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  rowCount: z.number().int(),
})
