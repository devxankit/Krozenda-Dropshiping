import { z } from 'zod'

// Mirrors backend/Controllers/orderController.js's serializeOrder().
export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number(),
  variant: z.string(),
})

export const shippingAddressSnapshotSchema = z.object({
  fullName: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  country: z.string(),
})

export const orderSchema = z.object({
  id: z.string(),
  items: z.array(orderItemSchema),
  shippingAddress: shippingAddressSnapshotSchema,
  subtotal: z.number(),
  discountAmount: z.number(),
  couponCode: z.string().nullable(),
  shippingFee: z.number(),
  total: z.number(),
  paymentMethod: z.enum(['COD', 'WALLET', 'RAZORPAY']),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED']),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
})

// POST /user/orders/razorpay-order response — the Razorpay order to open the
// checkout widget against for online payment.
export const razorpayOrderSchema = z.object({
  razorpayOrderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  keyId: z.string(),
})
