// Layer rule: services/ hold the model imports and business logic —
// controllers/ never import models directly.
import { Review } from '../../../models/index.js'

export async function createReview(userId, { productId, productName, rating, reviewText, photos }) {
  const review = await Review.create({
    user: userId,
    productId,
    productName,
    rating,
    reviewText,
    photos,
  })
  return review.populate('user', 'name')
}

// Deliberately not scoped to req.user — any authenticated buyer must be able
// to see reviews (and review photos) left by other buyers on the same
// product; that visibility is the whole point of a review.
export async function listReviewsForProduct(productId) {
  return Review.find({ productId }).sort({ createdAt: -1 }).populate('user', 'name')
}
