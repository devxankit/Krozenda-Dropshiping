import { z } from 'zod'

// Mirrors backend/Controllers/orderController.js's serializeOrder().
export const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number(),
  variant: z.string(),
  variantId: z.string().nullable().optional().default(null),
  // This line's share of the coupon discount (null on older orders).
  discountAmount: z.number().nullable().optional().default(null),
  hsnCode: z.string().optional().default(''),
  gstRate: z.number().optional().default(0),
  taxableValue: z.number().optional().default(0),
  taxAmount: z.number().optional().default(0),
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

export const orderStatusHistoryEntrySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  at: z.string(),
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
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  // DROPSHIP orders are fulfilled by CJ: the buyer can neither cancel nor
  // return them.
  fulfillmentType: z.enum(['STANDARD', 'DROPSHIP']).optional().default('STANDARD'),
  isDropship: z.boolean().optional().default(false),
  checkoutGroupId: z.string().nullable().optional().default(null),
  deliveredAt: z.string().nullable(),
  statusHistory: z.array(orderStatusHistoryEntrySchema),
  b2b: z
    .object({
      isB2B: z.boolean().default(false),
      companyName: z.string().default(''),
      gstin: z.string().default(''),
    })
    .nullable()
    .optional(),
  createdAt: z.string(),
})

// ---------------------------------------------------------------------------
// LIST ROW — mirrors backend serializeOrderSummary().
//
// A different, much smaller shape from `orderSchema` on purpose: GET
// /user/orders now returns summaries (id, total, status, a 3-thumbnail
// preview) and is paginated, because it previously returned every order the
// buyer had ever placed with every line item's full snapshot. The detail
// screen fetches the full document by id.
// ---------------------------------------------------------------------------
export const orderPreviewItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  quantity: z.number(),
})

// POST /user/orders response: the first order, plus every order the checkout
// produced — a cart with a dropshipping item and seller items is placed as
// two orders.
export const placedOrderSchema = orderSchema.extend({
  orders: z.array(orderSchema).optional(),
})

export const orderSummarySchema = z.object({
  id: z.string(),
  itemCount: z.number(),
  previewItems: z.array(orderPreviewItemSchema),
  total: z.number(),
  paymentMethod: z.enum(['COD', 'WALLET', 'RAZORPAY']),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']),
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  isDropship: z.boolean().optional().default(false),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
})

export const orderListSchema = z.array(orderSummarySchema)

// POST /user/orders/razorpay-order response — the Razorpay order to open the
// checkout widget against for online payment.
export const razorpayOrderSchema = z.object({
  razorpayOrderId: z.string(),
  amount: z.number(),
  currency: z.string(),
  keyId: z.string(),
})

// Buyer-facing tracking. Deliberately narrower than the seller's view: there
// is no seller identity, no carrier account, no cost and no internal status
// here, because /user/orders/:id/tracking does not return any of it.
export const buyerTrackingEventSchema = z.object({
  // Our mapped status, or null when the carrier sent wording we do not
  // recognise. Null is never guessed into a real status.
  status: z.string().nullable(),
  carrierStatus: z.string(),
  location: z.string(),
  description: z.string(),
  occurredAt: z.string(),
})

export const buyerParcelSchema = z.object({
  id: z.string(),
  type: z.string(),
  // Collapsed to the five states a buyer understands, not the 22 internal ones.
  status: z.string(),
  courierName: z.string(),
  awbCode: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  estimatedDeliveryAt: z.string().nullable(),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  items: z.array(z.object({ productId: z.string(), name: z.string(), quantity: z.number().int() })),
  events: z.array(buyerTrackingEventSchema),
})

export const orderTrackingSchema = z.object({
  orderId: z.string(),
  orderStatus: z.string(),
  // False is not an error: the order simply has not been handed to a courier
  // yet, and the screen says "preparing" rather than showing an empty tracker.
  hasShipments: z.boolean(),
  parcels: z.array(buyerParcelSchema),
})

// What checkout will actually charge. Every number here is the SERVER's — the
// client no longer adds up its own total, because the server's arithmetic is
// the one that gets billed and two implementations drift.

// One payment method's delivery price. `available: false` is a real answer for
// a row — COD can be switched off, or unsupported on this lane — and is not
// the same as the quote having failed.
const quotedMethodSchema = z.union([
  z.object({
    available: z.literal(true),
    shippingFee: z.number(),
    total: z.number(),
    isFree: z.boolean(),
    carrierCost: z.number(),
    estimatedDeliveryDays: z.number().nullable(),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string(),
    message: z.string(),
  }),
])

export const shippingQuoteSchema = z.object({
  paymentMethod: z.string(),
  subtotal: z.number(),
  discountAmount: z.number(),

  shippingFee: z.number(),
  total: z.number(),
  isFree: z.boolean(),
  carrierCost: z.number(),
  estimatedDeliveryDays: z.number().nullable(),

  // Keyed by payment method id, so a row can show its own price.
  methods: z.record(z.string(), quotedMethodSchema),

  // A dropshipping item in the cart: online payment only, and with seller
  // items too, the checkout is placed as `orderCount` separate orders.
  onlineOnly: z.boolean().optional().default(false),
  orderCount: z.number().int().optional().default(1),

  freeReason: z.string().nullable(),
  freeShippingThreshold: z.number(),
  amountToFreeShipping: z.number(),
  parcelCount: z.number().int(),
})
