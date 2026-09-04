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

export const couponListSchema = paged(
  z.object({
    id: z.string(),
    code: z.string(),
    description: z.string(),
    discountType: z.enum(['percentage', 'fixed', 'shipping']),
    discountValue: z.number(),
    minCartValue: z.number().int(),
    maxDiscount: z.number().int().nullable(),
    usageLimit: z.number().int().nullable(),
    used: z.number().int(),
    startsOn: z.string(),
    endsOn: z.string(),
    status: z.enum(['scheduled', 'active', 'paused', 'expired', 'exhausted']),
  }),
)

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

export const bannerListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      placement: z.string(),
      audience: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      priority: z.number().int(),
      status: z.enum(['scheduled', 'live', 'ended', 'draft']),
      clicks: z.number().int(),
      impressions: z.number().int(),
    }),
  ),
})

export const cmsPageListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      version: z.string(),
      updatedAt: z.string(),
      updatedBy: z.string(),
      status: z.enum(['draft', 'published', 'archived']),
      requiresAcceptance: z.boolean(),
    }),
  ),
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
    product: z.string(),
    sku: z.string(),
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
