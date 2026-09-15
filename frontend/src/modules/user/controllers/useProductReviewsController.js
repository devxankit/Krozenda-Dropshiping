// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchProductReviews } from '../services/reviewService'

// ProductDetailScreen's "Customer Reviews" tab.
export function useProductReviewsController(productId) {
  const query = useQuery({
    queryKey: ['user', 'reviews', 'product', productId],
    queryFn: () => fetchProductReviews(productId),
    enabled: Boolean(productId),
  })
  return { reviews: query.data || [], isLoading: query.isLoading }
}
