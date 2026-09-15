import { z } from 'zod'
import { ORDER_FLOW_STATUS, ORDER_PAYMENT_STATUS } from '../constants'

// Runtime contract for /admin/orders — mirrors backend/Models/Order.js
// exactly (one order per vendor's cart contents, no sub-orders, no GST/AWB
// concepts). Money fields are in PAISE — the backend scales its rupee
// storage up on the way out; see adminOrderController's toPaise.

const orderStatus = z.enum(Object.values(ORDER_FLOW_STATUS))
const paymentStatus = z.enum(Object.values(ORDER_PAYMENT_STATUS))
const paymentMethod = z.enum(['COD', 'WALLET', 'RAZORPAY'])

export const orderCustomerSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  mobileNumber: z.string(),
  email: z.string(),
})

export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number().int().positive(),
  variant: z.string(),
  vendorId: z.string().nullable(),
})

export const orderShippingAddressSchema = z.object({
  fullName: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string().nullable().optional(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  country: z.string(),
})

const orderBaseSchema = z.object({
  id: z.string(),
  items: z.array(orderItemSchema),
  shippingAddress: orderShippingAddressSchema,
  subtotal: z.number(),
  discountAmount: z.number(),
  couponCode: z.string().nullable(),
  shippingFee: z.number(),
  total: z.number(),
  paymentMethod,
  paymentStatus,
  status: orderStatus,
  deliveredAt: z.string().nullable(),
  statusHistory: z.array(z.object({ status: orderStatus, at: z.string() })),
  createdAt: z.string(),
  customer: orderCustomerSchema,
})

export const orderListItemSchema = orderBaseSchema

export const orderListSchema = z.object({
  items: z.array(orderListItemSchema),
  page: z.number().int().positive(),
  rowsPerPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  tabCounts: z.record(z.string(), z.number()),
})

export const orderDetailSchema = orderBaseSchema
