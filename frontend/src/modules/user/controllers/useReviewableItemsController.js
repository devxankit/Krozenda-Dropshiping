// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchReviewableItems } from '../services/reviewService'

export const REVIEWABLE_QUERY_KEY = ['user', 'reviews', 'reviewable']

// Powers the delivered-products dropdown on RateReviewScreen.
export function useReviewableItemsController() {
  const query = useQuery({ queryKey: REVIEWABLE_QUERY_KEY, queryFn: fetchReviewableItems })
  return { items: query.data || [], isLoading: query.isLoading }
}
