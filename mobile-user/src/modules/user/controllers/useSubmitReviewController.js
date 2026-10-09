// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitReview } from '../services/reviewService'
import { REVIEWABLE_QUERY_KEY } from './useReviewableItemsController'

export function useSubmitReviewController() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: submitReview,
    // Refreshes the dropdown's alreadyReviewed/reviewsCount for this product
    // immediately, instead of waiting for the next natural refetch.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWABLE_QUERY_KEY }),
  })

  return {
    submitReview: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
