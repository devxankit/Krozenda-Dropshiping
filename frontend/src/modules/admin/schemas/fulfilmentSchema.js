import { z } from 'zod'
import { BUSINESS_MODEL } from '../../../config/constants'

// Runtime contract for the fulfilment endpoints. Money is in PAISE.

const businessModel = z.enum([
  BUSINESS_MODEL.MARKETPLACE,
  BUSINESS_MODEL.DROPSHIPPING,
  BUSINESS_MODEL.OWN_STOCK,
])

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

export const subOrderListItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  placedAt: z.string(),
  model: businessModel,
  seller: z.string(),
  buyer: z.string(),
  status: z.string(),
  awb: z.string().nullable(),
  ageHours: z.number().int(),
  total: z.number().int(),
})

export const subOrderListSchema = paged(subOrderListItemSchema)

export const shipmentSchema = z.object({
  id: z.string(),
  subOrderId: z.string(),
  awb: z.string(),
  courier: z.string(),
  seller: z.string(),
  pickupPincode: z.string(),
  dropPincode: z.string(),
  status: z.string(),
  lastEvent: z.string(),
  lastEventAt: z.string(),
  promisedBy: z.string(),
  isLate: z.boolean(),
})

export const shipmentListSchema = paged(shipmentSchema)

export const rtoSchema = z.object({
  id: z.string(),
  subOrderId: z.string(),
  awb: z.string(),
  seller: z.string(),
  reason: z.enum(['undelivered', 'address_failure', 'customer_unreachable', 'refused']),
  initiatedAt: z.string(),
  costBearer: z.enum(['platform', 'vendor', 'buyer']),
  shippingCost: z.number().int(),
  orderValue: z.number().int(),
  settlementReversed: z.boolean(),
  stockRestored: z.boolean(),
})

export const rtoListSchema = paged(rtoSchema)

export const returnListItemSchema = z.object({
  rejectionReason: z.string().optional(),
  id: z.string(),
  subOrderId: z.string(),
  buyer: z.string(),
  seller: z.string(),
  reason: z.enum(['damaged', 'wrong_product', 'missing_product']),
  // What the buyer asked for — the only thing admin can approve.
  requestType: z.enum(['REFUND', 'REPLACEMENT']).optional(),
  raisedAt: z.string(),
  evidenceCount: z.number().int(),
  status: z.enum(['awaiting_review', 'approved', 'rejected', 'replacement_issued', 'refunded']),
  value: z.number().int(),
})

export const returnListSchema = paged(returnListItemSchema)

export const returnDetailSchema = returnListItemSchema.extend({
  buyerNote: z.string(),
  evidence: z.array(
    z.object({ id: z.string(), caption: z.string(), uploadedAt: z.string(), url: z.string().nullable().optional() }),
  ),
  item: z.object({ name: z.string(), sku: z.string(), quantity: z.number().int(), unitPrice: z.number().int() }),
  policy: z.object({
    windowDays: z.number().int(),
    raisedWithinWindow: z.boolean(),
    allowedReason: z.boolean(),
    returnShippingBearer: z.enum(['platform', 'vendor', 'buyer']),
  }),
  // Where the request is after approval; drives the page's actions.
  progress: z
    .object({
      stage: z.string(),
      pickupMode: z.enum(['COURIER', 'MANUAL', 'NOT_REQUIRED']).nullable(),
      pickupStatus: z.string().nullable(),
      pickupAwb: z.string().nullable(),
      pickupCourier: z.string().nullable(),
      pickupError: z.string().nullable(),
      itemReceivedAt: z.string().nullable(),
      restocked: z.boolean(),
      completedAt: z.string().nullable(),
      refundDestination: z.enum(['WALLET', 'RAZORPAY']).nullable(),
      razorpayRefundId: z.string().nullable(),
      replacementOrderId: z.string().nullable(),
      orderId: z.string(),
    })
    .optional(),
  timeline: z.array(
    z.object({
      label: z.string(),
      at: z.string().nullable(),
      actor: z.string().nullable(),
      reason: z.string().nullable(),
      done: z.boolean(),
      tone: z.enum(['default', 'success', 'warning', 'danger']).optional(),
    }),
  ),
})

export const cancellationSchema = z.object({
  id: z.string(),
  subOrderId: z.string(),
  orderId: z.string(),
  cancelledBy: z.enum(['buyer', 'admin', 'vendor']),
  actor: z.string(),
  reason: z.string(),
  cancelledAt: z.string(),
  refundStatus: z.enum(['not_required', 'pending', 'processing', 'completed', 'failed']),
  refundAmount: z.number().int(),
})

export const cancellationListSchema = paged(cancellationSchema)

export const invoiceSchema = z.object({
  voided: z.boolean().optional(),
  voidReason: z.string().optional(),
  id: z.string(),
  number: z.string(),
  subOrderId: z.string(),
  sellerOfRecord: z.string(),
  buyer: z.string(),
  issuedAt: z.string(),
  taxableValue: z.number().int(),
  gst: z.number().int(),
  total: z.number().int(),
  placeOfSupply: z.string(),
  isInterState: z.boolean(),
})

export const invoiceListSchema = paged(invoiceSchema)

export const invoiceDetailSchema = invoiceSchema.extend({
  seller: z.object({ name: z.string(), gstin: z.string(), address: z.string() }),
  buyerDetail: z.object({ name: z.string(), gstin: z.string().nullable(), address: z.string() }),
  lines: z.array(
    z.object({
      name: z.string(),
      hsn: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number().int(),
      taxableValue: z.number().int(),
      gstRate: z.number(),
      cgst: z.number().int(),
      sgst: z.number().int(),
      igst: z.number().int(),
      total: z.number().int(),
    }),
  ),
})

export const subOrderSchema = subOrderListItemSchema
export const returnSchema = returnListItemSchema
