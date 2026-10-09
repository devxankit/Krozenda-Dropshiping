import { z } from 'zod'

// Mirrors backend/Controllers/couponController.js's listUsedCoupons().
export const usedCouponProductSchema = z.object({
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  quantity: z.number(),
})

export const usedCouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  discountAmount: z.number(),
  redeemedAt: z.string(),
  orderId: z.string(),
  orderTotal: z.number(),
  products: z.array(usedCouponProductSchema),
})

export const usedCouponListSchema = z.array(usedCouponSchema)

// POST /user/coupons/apply response.
export const applyCouponResultSchema = z.object({
  code: z.string(),
  discountAmount: z.number(),
})
