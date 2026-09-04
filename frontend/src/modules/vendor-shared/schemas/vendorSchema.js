import { z } from 'zod'

// Runtime contracts for Vendor Panel API endpoints. Money in PAISE.

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

export const vendorSummarySchema = z.object({
  storeName: z.string(),
  status: z.string(),
  totalRevenue: z.number().int(),
  pendingOrdersCount: z.number().int(),
  liveSkusCount: z.number().int(),
  availablePayout: z.number().int(),
  kycStatus: z.string(),
  routeLinked: z.boolean(),
})

export const vendorProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  costPrice: z.number().int(),
  sellingPrice: z.number().int(),
  b2bPrice: z.number().int().optional(),
  marginPct: z.number(),
  stock: z.number().int(),
  moq: z.number().int(),
  status: z.string(),
  updatedAt: z.string(),
})

export const vendorProductListSchema = paged(vendorProductSchema)

export const vendorOrderSchema = z.object({
  id: z.string(),
  parentOrderId: z.string(),
  customerName: z.string(),
  phone: z.string(),
  shippingAddress: z.string(),
  productName: z.string(),
  quantity: z.number().int(),
  orderValue: z.number().int(),
  commissionAmount: z.number().int(),
  netPayable: z.number().int(),
  forwardingStatus: z.string(),
  awb: z.string().nullable(),
  placedAt: z.string(),
})

export const vendorOrderListSchema = paged(vendorOrderSchema)

export const vendorSettlementSchema = z.object({
  id: z.string(),
  routeTransferId: z.string(),
  subOrderId: z.string(),
  grossAmount: z.number().int(),
  commission: z.number().int(),
  netPayout: z.number().int(),
  status: z.string(),
  transferredAt: z.string(),
})

export const vendorSettlementListSchema = z.array(vendorSettlementSchema)

export const vendorKycDocSchema = z.object({
  id: z.string(),
  type: z.string(),
  fileName: z.string().nullable(),
  fileSize: z.string().nullable(),
  uploadedAt: z.string().nullable(),
  status: z.string(),
  required: z.boolean(),
  rejectionReason: z.string().nullable(),
})

export const vendorKycListSchema = z.array(vendorKycDocSchema)

export const vendorSettingsSchema = z.object({
  storeName: z.string(),
  entityType: z.string(),
  contactPerson: z.string(),
  email: z.string(),
  phone: z.string(),
  city: z.string(),
  pickupPincode: z.string(),
  pickupAddress: z.string(),
  bankName: z.string(),
  accountNumberMasked: z.string(),
  ifsc: z.string(),
  razorpayAccountId: z.string(),
  smsAlerts: z.boolean(),
  emailAlerts: z.boolean(),
})
