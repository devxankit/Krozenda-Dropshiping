import { z } from 'zod'

// Runtime contract for POST /users/reviews and GET /users/reviews — mirrors
// backend/src/modules/user/controllers/reviewController.js's
// serializeReview(). `photos` are absolute /uploads URLs (see
// backend/src/middlewares/upload.js's publicUrlFor()), safe to render
// directly in an <img src>.
export const reviewSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  rating: z.number(),
  reviewText: z.string(),
  photos: z.array(z.string()),
  author: z.string(),
  createdAt: z.string(),
})

export const reviewListSchema = z.array(reviewSchema)
