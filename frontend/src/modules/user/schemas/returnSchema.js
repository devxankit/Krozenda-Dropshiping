import { z } from 'zod'

// Mirrors backend/Controllers/returnController.js's getReturnableItems().
export const returnableItemSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number(),
  deliveredAt: z.string(),
  existingRequest: z
    .object({
      id: z.string(),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
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
  productName: z.string(),
  productImage: z.string().nullable(),
  requestType: z.enum(['REPLACEMENT', 'REFUND']),
  reason: z.string(),
  photos: z.array(z.string()),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  adminNote: z.string(),
  refundAmount: z.number().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
})
