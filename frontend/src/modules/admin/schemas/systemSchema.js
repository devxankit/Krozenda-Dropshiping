import { z } from 'zod'
import { INTEGRATION_HEALTH } from '../constants'

// Runtime contract for the settings & system endpoints.

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

// The billing specification's `platform_configurations` document, as a form.
// Everything here is DATA — no financial logic is hardcoded (billing spec §7).
export const businessRulesSchema = z.object({
  sellerModel: z.object({
    commissionType: z.enum(['percentage', 'fixed']),
    commissionRate: z.number(),
    gstOnCommissionRate: z.number(),
    tcsSec52Rate: z.number(),
    tdsSec194oRate: z.number(),
    settlementHoldDays: z.number().int(),
    shippingBearer: z.enum(['buyer', 'seller', 'platform']),
  }),
  dropshipModel: z.object({
    defaultMarginPercentage: z.number(),
    settlementHoldDays: z.number().int(),
    merchantOfRecord: z.string(),
    b2bGstCreditEnabled: z.boolean(),
  }),
  logistics: z.object({
    defaultFlatShippingRate: z.number().int(),
    freeShippingThreshold: z.number().int(),
  }),
  payouts: z.object({
    autoPayoutEnabled: z.boolean(),
    approvalMode: z.enum(['automatic', 'maker_checker']),
    minimumPayoutAmount: z.number().int(),
    schedule: z.string(),
    transferMode: z.string(),
    lastRunAt: z.string().nullable(),
  }),
  returns: z.object({
    windowDays: z.number().int(),
    minimumEvidencePhotos: z.number().int(),
    rtoCostBearer: z.enum(['buyer', 'vendor', 'platform']),
  }),
  changed: z.array(z.string()),
})

export const generalSettingsSchema = z.object({
  platform: z.object({
    name: z.string(),
    legalEntity: z.string().optional().default(''),
    gstin: z.string().optional().default(''),
    supportEmail: z.string().optional().default(''),
    supportPhone: z.string().optional().default(''),
    footerTagline: z.string().optional().default(''),
    copyrightText: z.string().optional().default(''),
    socialLinks: z
      .object({
        whatsapp: z.string().optional().default(''),
        instagram: z.string().optional().default(''),
        linkedin: z.string().optional().default(''),
        twitter: z.string().optional().default(''),
        youtube: z.string().optional().default(''),
        facebook: z.string().optional().default(''),
      })
      .optional()
      .default({}),
    quickLinks: z
      .array(z.object({ label: z.string(), path: z.string() }))
      .optional()
      .default([]),
    customerLinks: z
      .array(z.object({ label: z.string(), path: z.string() }))
      .optional()
      .default([]),
    legalLinks: z
      .array(z.object({ label: z.string(), path: z.string() }))
      .optional()
      .default([]),
    timezone: z.string().optional().default('Asia/Kolkata (IST, UTC+5:30)'),
    currency: z.string().optional().default('Indian Rupee (INR)'),
    defaultCommissionPercent: z.number().optional().default(10),
    commissionRate: z.number().optional().default(10),
    commissionType: z.enum(['percentage', 'flat']).optional().default('percentage'),
    defaultGstRate: z.number().optional().default(18),
    gstRate: z.number().optional().default(18),
    gstType: z.enum(['percentage', 'flat']).optional().default('percentage'),
    gstOnCommissionRate: z.number().optional().default(18),
    commissionBase: z.string().optional().default('LINE_NET_OF_SELLER_FUNDED_DISCOUNT'),
  }),
  toggles: z.array(
    z.object({ key: z.string(), label: z.string(), description: z.string(), enabled: z.boolean() }),
  ).optional().default([]),
})

export const integrationListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      purpose: z.string(),
      status: z.enum(Object.values(INTEGRATION_HEALTH)),
      note: z.string().nullable(),
      environment: z.string(),
      lastEventAt: z.string().nullable(),
      ownedBy: z.enum(['platform', 'client']),
      settingsPath: z.string(),
    }),
  ),
})

export const securitySettingsSchema = z.object({
  policies: z.array(
    z.object({ key: z.string(), label: z.string(), description: z.string(), enabled: z.boolean() }),
  ),
  sessionMaxHours: z.number().int(),
  passwordMinLength: z.number().int(),
  lockoutAttempts: z.number().int(),
  ipAllowlist: z.array(z.string()),
  recentSignIns: z.array(
    z.object({
      id: z.string(),
      person: z.string(),
      at: z.string(),
      ip: z.string(),
      location: z.string(),
      device: z.string(),
      outcome: z.enum(['success', 'failed', 'locked']),
    }),
  ),
})

export const webhookListSchema = z.object({
  keys: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      prefix: z.string(),
      createdAt: z.string(),
      lastUsedAt: z.string().nullable(),
      scopes: z.array(z.string()),
    }),
  ),
  endpoints: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      events: z.array(z.string()),
      status: z.enum(['healthy', 'failing', 'disabled']),
      lastDeliveryAt: z.string().nullable(),
      failures24h: z.number().int(),
    }),
  ),
})

export const policySettingsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      effectiveFrom: z.string(),
      acceptedBy: z.number().int(),
      pendingAcceptance: z.number().int(),
      requiresReacceptance: z.boolean(),
    }),
  ),
})

export const taxSettingsSchema = z.object({
  slabs: z.array(
    z.object({ rate: z.number(), label: z.string(), productCount: z.number().int() }),
  ),
  defaults: z.object({
    placeOfSupplyRule: z.string(),
    hsnRequiredFrom: z.string(),
    roundingRule: z.string(),
    invoicePrefix: z.string(),
  }),
})

export const auditLogSchema = paged(
  z.object({
    id: z.string(),
    at: z.string(),
    actor: z.string(),
    actorRole: z.string(),
    action: z.string(),
    entity: z.string(),
    entityId: z.string(),
    ip: z.string(),
    before: z.string().nullable(),
    after: z.string().nullable(),
    severity: z.enum(['info', 'notable', 'critical']),
    // Present on live rows (see backend adminAuditLogController); fixtures omit them.
    description: z.string().optional(),
    method: z.string().optional(),
    statusCode: z.number().int().optional(),
    success: z.boolean().optional(),
  }),
)

export const backupSchema = z.object({
  schedule: z.object({
    daily: z.boolean(),
    dailyAt: z.string(),
    cloudReplication: z.boolean(),
    retentionDays: z.number().int(),
    lastRestoreTestAt: z.string().nullable(),
  }),
  runs: z.array(
    z.object({
      id: z.string(),
      startedAt: z.string(),
      sizeMb: z.number(),
      durationSeconds: z.number(),
      destination: z.string(),
      status: z.enum(['success', 'failed', 'running']),
    }),
  ),
})

export const supportTicketListSchema = paged(
  z.object({
    id: z.string(),
    subject: z.string(),
    raisedBy: z.string(),
    party: z.enum(['buyer', 'seller']),
    category: z.string(),
    openedAt: z.string(),
    ageHours: z.number().int(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    owner: z.string().nullable(),
    status: z.enum(['open', 'waiting', 'resolved', 'closed']),
    escalatedToAdmin: z.boolean().optional(),
    vendorName: z.string().nullable().optional(),
  }),
)

export const supportTicketMessageSchema = z.object({
  id: z.string().optional(),
  sender: z.enum(['user', 'vendor', 'agent', 'system']),
  senderName: z.string(),
  message: z.string(),
  attachments: z.array(z.string()).optional(),
  isInternal: z.boolean().optional(),
  createdAt: z.union([z.string(), z.date()]),
})

export const supportTicketDetailSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  subject: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  party: z.enum(['buyer', 'seller']),
  raisedByRole: z.enum(['customer', 'vendor']).optional(),
  targetRole: z.enum(['vendor', 'admin']).optional(),
  vendorId: z.string().nullable().optional(),
  category: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['open', 'waiting', 'resolved', 'closed']),
  orderId: z.string().nullable().optional(),
  orderNumber: z.string().optional(),
  productName: z.string().optional(),
  owner: z.string().nullable(),
  escalatedToAdmin: z.boolean().optional(),
  messages: z.array(supportTicketMessageSchema),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
})

export const adminProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  joinedAt: z.string(),
  twoFactorEnabled: z.boolean(),
  sessions: z.array(
    z.object({
      id: z.string(),
      device: z.string(),
      location: z.string(),
      lastActiveAt: z.string(),
      current: z.boolean(),
    }),
  ),
  notifications: z.array(
    z.object({ key: z.string(), label: z.string(), email: z.boolean(), push: z.boolean() }),
  ),
})
