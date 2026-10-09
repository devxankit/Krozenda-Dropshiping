import { z } from 'zod'

// Mirrors backend/Controllers/returnController.js's getReturnableItems().
export const returnableItemSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  // Two variants of one product are two separately returnable lines.
  variantId: z.string().nullable().optional().default(null),
  variant: z.string().optional().default(''),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number(),
  deliveredAt: z.string(),
  existingRequest: z
    .object({
      id: z.string(),
      status: z.enum(['PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED']),
      requestType: z.enum(['REPLACEMENT', 'REFUND']),
    })
    .nullable(),
})

export const returnableListSchema = z.array(returnableItemSchema)

// Mirrors backend/Controllers/returnController.js's serializeRequest().
export const returnRequestSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  variantId: z.string().nullable().optional().default(null),
  productName: z.string(),
  productImage: z.string().nullable(),
  requestType: z.enum(['REPLACEMENT', 'REFUND']),
  reason: z.string(),
  photos: z.array(z.string()),
  status: z.enum(['PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED']),
  adminNote: z.string(),
  refundAmount: z.number().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  // After approval: ACCEPTED waits for the item, APPROVED is done.
  acceptedAt: z.string().nullable().optional().default(null),
  pickupMode: z.enum(['COURIER', 'MANUAL', 'NOT_REQUIRED']).nullable().optional().default(null),
  itemReceivedAt: z.string().nullable().optional().default(null),
  completedAt: z.string().nullable().optional().default(null),
  refundDestination: z.enum(['WALLET', 'RAZORPAY']).nullable().optional().default(null),
  replacementOrderId: z.string().nullable().optional().default(null),
})
