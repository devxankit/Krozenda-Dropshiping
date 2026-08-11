// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { reviewSchema, reviewListSchema } from '../schemas/reviewSchema'

// The server wraps every response as { success, message, data } (see
// backend/src/lib/ApiResponse.js) — unwrap .data.data, not .data, to get
// the actual payload.
export async function submitReview({ productId, productName, rating, reviewText, photoFiles }) {
  const formData = new FormData()
  formData.append('productId', productId)
  formData.append('productName', productName)
  formData.append('rating', String(rating))
  formData.append('reviewText', reviewText)
  photoFiles.forEach((file) => formData.append('photos', file))

  const response = await api.post('/users/reviews', formData)
  return reviewSchema.parse(response.data.data)
}

// Lets any signed-in buyer load reviews (and review photos) left by other
// buyers on a product — the visibility half of the upload feature.
export async function fetchProductReviews(productId) {
  const response = await api.get('/users/reviews', { params: { productId } })
  return reviewListSchema.parse(response.data.data)
}
