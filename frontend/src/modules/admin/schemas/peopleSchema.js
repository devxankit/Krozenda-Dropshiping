import { z } from 'zod'
import { REVIEW_STATUS } from '../constants'

// Runtime contract for the people & vendor endpoints. Money is in PAISE.

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

export const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  type: z.enum(['retail', 'b2b_dealer', 'b2b_distributor', 'b2b_wholesaler', 'b2b_trader']),
  orders: z.number().int(),
  lifetimeValue: z.number().int(),
  lastOrderAt: z.string().nullable(),
  status: z.enum(['active', 'dormant', 'blocked']),
})

export const customerListSchema = paged(customerSchema)

export const vendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  model: z.enum(['marketplace', 'dropshipping', 'own_stock']),
  role: z.string(),
  city: z.string(),
  gstin: z.string().nullable(),
  products: z.number().int(),
  orders: z.number().int(),
  revenue: z.number().int(),
  kycStatus: reviewStatus,
  routeLinked: z.boolean(),
  joinedAt: z.string(),
  status: z.enum(['active', 'suspended', 'pending']),
})

export const vendorListSchema = paged(vendorSchema)

export const kycDocumentSchema = z.object({
  id: z.string(),
  type: z.string(),
  fileName: z.string().nullable(),
  fileSize: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  status: reviewStatus,
  required: z.boolean(),
  rejectionReason: z.string().nullable(),
})

export const kycApplicationSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  role: z.string(),
  model: z.string(),
  submittedAt: z.string(),
  waitingDays: z.number().int(),
  status: reviewStatus,
  business: z.object({
    constitution: z.string(),
    pan: z.string(),
    gstin: z.string(),
    categories: z.array(z.string()),
    pickupPincode: z.string(),
    contactName: z.string(),
    contactPhone: z.string(),
  }),
  payout: z.object({
    bank: z.string(),
    accountMasked: z.string(),
    ifsc: z.string(),
    routeLinked: z.boolean(),
  }),
  documents: z.array(kycDocumentSchema),
  policyAcceptances: z.array(
    z.object({
      policy: z.string(),
      version: z.string(),
      acceptedAt: z.string().nullable(),
      ip: z.string().nullable(),
      superseded: z.boolean(),
    }),
  ),
})

export const kycQueueSchema = paged(
  z.object({
    id: z.string(),
    vendorName: z.string(),
    role: z.string(),
    submittedAt: z.string(),
    waitingDays: z.number().int(),
    documentsApproved: z.number().int(),
    documentsRequired: z.number().int(),
    status: reviewStatus,
  }),
)

export const policyAcceptanceListSchema = paged(
  z.object({
    id: z.string(),
    party: z.string(),
    partyType: z.string(),
    policy: z.string(),
    version: z.string(),
    acceptedAt: z.string(),
    ip: z.string(),
    current: z.boolean(),
  }),
)

export const staffListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      roleId: z.string(),
      lastSignInAt: z.string().nullable(),
      twoFactor: z.boolean(),
      status: z.enum(['active', 'invited', 'suspended']),
    }),
  ),
})

export const roleListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      surface: z.string(),
      description: z.string(),
      memberCount: z.number().int(),
      permissionCount: z.number().int(),
      immutable: z.boolean(),
    }),
  ),
})

export const roleDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  surface: z.string(),
  description: z.string(),
  immutable: z.boolean(),
  memberCount: z.number().int(),
  groups: z.array(
    z.object({
      label: z.string(),
      permissions: z.array(
        z.object({ key: z.string(), label: z.string(), granted: z.boolean(), description: z.string() }),
      ),
    }),
  ),
})
