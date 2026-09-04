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
    legalEntity: z.string(),
    gstin: z.string(),
    supportEmail: z.string(),
    supportPhone: z.string(),
    timezone: z.string(),
    currency: z.string(),
  }),
  toggles: z.array(
    z.object({ key: z.string(), label: z.string(), description: z.string(), enabled: z.boolean() }),
  ),
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
  }),
)

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
