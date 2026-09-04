import { z } from 'zod'
import { BUSINESS_MODEL } from '../../../config/constants'
import { FULFILMENT_STATUS, PAYMENT_STATUS } from '../constants'

// Runtime contract for the orders endpoints. These schemas validate the
// fixtures today and the API tomorrow — so this file is the specification the
// backend has to satisfy, not a convenience.
//
// Money is in PAISE, integer, throughout. Rupee floats in a settlement system
// are how reconciliation drifts by a few paise a thousand orders in.

const businessModel = z.enum([
  BUSINESS_MODEL.MARKETPLACE,
  BUSINESS_MODEL.DROPSHIPPING,
  BUSINESS_MODEL.OWN_STOCK,
])

const paymentStatus = z.enum(Object.values(PAYMENT_STATUS))
const fulfilmentStatus = z.enum(Object.values(FULFILMENT_STATUS))

export const buyerSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  pincode: z.string(),
  type: z.enum(['retail', 'b2b_dealer', 'b2b_distributor', 'b2b_wholesaler', 'b2b_trader']),
})

export const orderListItemSchema = z.object({
  id: z.string(),
  placedAt: z.string(),
  buyer: buyerSchema,
  models: z.array(businessModel).min(1),
  sellerCount: z.number().int().positive(),
  itemCount: z.number().int().positive(),
  paymentStatus,
  fulfilmentStatus,
  total: z.number().int(),
})

export const orderListSchema = z.object({
  items: z.array(orderListItemSchema),
  page: z.number().int().positive(),
  rowsPerPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  tabCounts: z.record(z.string(), z.number()),
})

export const subOrderSchema = z.object({
  id: z.string(),
  model: businessModel,
  seller: z.object({ id: z.string(), name: z.string() }),
  status: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sku: z.string(),
      hsn: z.string(),
      gstRate: z.number(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().int(),
      lineTotal: z.number().int(),
    }),
  ),
  // Snapshotted at order time (project context §6.5) — never recomputed from
  // the current commission rules.
  commission: z.object({
    type: z.enum(['percentage', 'fixed']),
    value: z.number(),
    amount: z.number().int(),
    resolvedFrom: z.enum(['product', 'vendor', 'category', 'company', 'default']),
  }),
  shipment: z
    .object({
      awb: z.string().nullable(),
      courier: z.string().nullable(),
      pickupPincode: z.string(),
    })
    .nullable(),
  settlement: z.object({ status: z.string(), eligibleAt: z.string().nullable(), net: z.number().int() }),
  subtotal: z.number().int(),
  tax: z.number().int(),
  shipping: z.number().int(),
  total: z.number().int(),
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

export const orderDetailSchema = z.object({
  id: z.string(),
  placedAt: z.string(),
  buyer: buyerSchema.extend({
    email: z.string(),
    phone: z.string(),
    gstin: z.string().nullable(),
  }),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  }),
  payment: z.object({
    status: paymentStatus,
    method: z.string(),
    reference: z.string(),
    capturedAt: z.string().nullable(),
  }),
  fulfilmentStatus,
  totals: z.object({
    subtotal: z.number().int(),
    tax: z.number().int(),
    shipping: z.number().int(),
    discount: z.number().int(),
    total: z.number().int(),
    commission: z.number().int(),
  }),
  subOrders: z.array(subOrderSchema).min(1),
})
