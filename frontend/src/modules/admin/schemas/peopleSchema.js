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
  image: z.string().nullable().optional(),
  dob: z.coerce.string().nullable().optional(),
  type: z.enum(['retail', 'b2b_dealer', 'b2b_distributor', 'b2b_wholesaler', 'b2b_trader']),
  orders: z.number().int(),
  lifetimeValue: z.number().int(),
  lastOrderAt: z.string().nullable(),
  status: z.enum(['active', 'dormant', 'blocked']),
})

export const customerListSchema = paged(customerSchema)

// Mirrors serializeVendor in backend/Controllers/vendorAuthController.js,
// plus the trade stats the admin list aggregates on top of it. One shape
// covers B2B and B2C — a B2C partner simply leaves the business and
// contact-person blocks empty.
export const vendorSchema = z.object({
  id: z.string(),
  vendorType: z.enum(['B2C', 'B2B']),
  name: z.string(),
  email: z.string(),
  mobile: z.string(),
  profileImage: z.string().nullable(),
  category: z.string().nullable(),
  gstRegistered: z.boolean(),
  business: z
    .object({
      businessName: z.string().optional(),
      tradeName: z.string().optional(),
      businessType: z.string().nullable().optional(),
      pan: z.string().optional(),
      gstin: z.string().optional(),
      udyamNumber: z.string().optional(),
    })
    .default({}),
  contactPerson: z
    .object({
      name: z.string().optional(),
      designation: z.string().optional(),
      mobile: z.string().optional(),
      email: z.string().optional(),
    })
    .default({}),
  address: z
    .object({
      addressLine: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      pincode: z.string().optional(),
      country: z.string().optional(),
    })
    .default({}),
  bank: z
    .object({
      accountHolderName: z.string().optional(),
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifsc: z.string().optional(),
    })
    .default({}),
  verificationStatus: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  rejectionReason: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  products: z.number().int(),
  orders: z.number().int(),
  revenue: z.number().int(),
})

export const vendorListSchema = z.object({
  items: z.array(vendorSchema),
  stats: z.object({
    total: z.number().int(),
    pending: z.number().int(),
    underReview: z.number().int(),
    approved: z.number().int(),
    rejected: z.number().int(),
    active: z.number().int(),
  }),
})

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
