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

// GET /catalog/coupons (publicCouponRoutes -> listPublicCoupons) response.
export const publicCouponSchema = z.object({
  code: z.string(),
  description: z.string(),
  discountType: z.enum(['PERCENTAGE', 'FIXED', 'FREE_SHIPPING']),
  discountValue: z.number(),
  maxDiscountAmount: z.number().nullable(),
  minOrderAmount: z.number(),
  endDate: z.string(),
})

export const publicCouponListSchema = z.array(publicCouponSchema)
