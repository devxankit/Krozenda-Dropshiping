// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation } from '@tanstack/react-query'
import { submitReview } from '../services/reviewService'

export function useSubmitReviewController() {
  const mutation = useMutation({
    mutationFn: submitReview,
  })

  return {
    submitReview: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}
