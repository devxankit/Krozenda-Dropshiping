import { z } from 'zod'

// Runtime contract for POST /user/reviews and GET /user/reviews — mirrors
// backend/Controllers/reviewController.js's serializeReview(). `photos` are
// absolute /uploads URLs (see backend/utils/imageHelper.js's getImageUrl()),
// safe to render directly in an <img src>.
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

// GET /user/reviews/reviewable — the delivered-but-maybe-not-yet-reviewed
// products that populate the dropdown on RateReviewScreen.
export const reviewableItemSchema = z.object({
  orderId: z.string(),
  productId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  deliveredAt: z.string(),
  reviewsCount: z.number(),
  rating: z.number(),
  alreadyReviewed: z.boolean(),
  myReview: z
    .object({
      rating: z.number(),
      reviewText: z.string(),
      photos: z.array(z.string()),
    })
    .nullable(),
})

export const reviewableListSchema = z.array(reviewableItemSchema)
