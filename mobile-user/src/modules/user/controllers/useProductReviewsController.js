// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchProductReviews } from '../services/reviewService'

// ProductDetailScreen's "Customer Reviews" tab. Paginated — a popular product
// used to send every review it had ever received on the first paint.
export function useProductReviewsController(productId, { page = 1, limit = 10 } = {}) {
  const query = useQuery({
    queryKey: ['user', 'reviews', 'product', productId, { page, limit }],
    queryFn: ({ signal }) => fetchProductReviews(productId, { page, limit }, { signal }),
    enabled: Boolean(productId),
    placeholderData: keepPreviousData,
  })

  return {
    reviews: query.data?.items ?? [],
    summary: query.data?.summary ?? null,
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
