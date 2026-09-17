// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { reviewSchema, reviewListSchema, reviewableListSchema } from '../schemas/reviewSchema'

// The server wraps every response as { success, message, data } (see
// backend/Controllers/*.js res.json calls) — unwrap .data.data, not .data,
// to get the actual payload.
export async function submitReview({ productId, orderId, rating, reviewText, photoFiles }) {
  const formData = new FormData()
  formData.append('productId', productId)
  formData.append('orderId', orderId)
  formData.append('rating', String(rating))
  formData.append('reviewText', reviewText)
  photoFiles.forEach((file) => formData.append('photos', file))

  const response = await api.post('/user/reviews', formData)
  return reviewSchema.parse(response.data.data)
}

// Lets any signed-in buyer load reviews (and review photos) left by other
// buyers on a product — the visibility half of the upload feature.
// BREAKING (documented in the audit report): `data` used to be a bare array.
// It is now the standard { items, total, summary } envelope so the endpoint
// can be paginated and carry the rating histogram.
export async function fetchProductReviews(productId, { page = 1, limit = 10 } = {}, { signal } = {}) {
  const response = await api.get('/user/reviews', {
    params: { productId, page, limit },
    signal,
  })
  return {
    items: reviewListSchema.parse(response.data.data.items),
    total: response.data.data.total ?? 0,
    summary: response.data.data.summary ?? null,
    pagination: response.data.pagination ?? null,
  }
}

// Delivered-but-maybe-not-yet-reviewed products for this buyer — powers the
// dropdown on RateReviewScreen.
export async function fetchReviewableItems() {
  const response = await api.get('/user/reviews/reviewable')
  return reviewableListSchema.parse(response.data.data.items)
}
