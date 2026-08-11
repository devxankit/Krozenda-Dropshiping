// Layer rule: controllers/ handle req/res and call services/ — no model
// imports here.
import { asyncHandler } from '../../../lib/asyncHandler.js'
import { ApiResponse } from '../../../lib/ApiResponse.js'
import { publicUrlFor } from '../../../middlewares/upload.js'
import { createReview as createReviewRecord, listReviewsForProduct } from '../services/reviewService.js'

function serializeReview(review) {
  return {
    id: review._id.toString(),
    productId: review.productId,
    productName: review.productName,
    rating: review.rating,
    reviewText: review.reviewText,
    photos: review.photos,
    author: review.user?.name ?? 'Buyer',
    createdAt: review.createdAt,
  }
}

// POST /users/reviews — multipart/form-data, photos come through
// middlewares/upload.js's multer instance (see routes.js) as req.files.
export const createReview = asyncHandler(async (req, res) => {
  const photos = (req.files ?? []).map((file) => publicUrlFor(req, 'reviews', file.filename))

  const review = await createReviewRecord(req.user.id, { ...req.body, photos })

  new ApiResponse(201, serializeReview(review), 'Review submitted.').send(res)
})

// GET /users/reviews?productId=... — any authenticated buyer, not just the
// review's author, can read this: this is what makes an uploaded photo
// visible to other users instead of only the uploader's own browser tab.
export const listProductReviews = asyncHandler(async (req, res) => {
  const reviews = await listReviewsForProduct(req.query.productId)
  new ApiResponse(200, reviews.map(serializeReview)).send(res)
})
