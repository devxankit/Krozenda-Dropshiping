// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReturnableItems, submitReturnRequest } from '../services/returnService'

const QUERY_KEY = ['user', 'returns', 'returnable']

// ReturnReplacementScreen.
export function useReturnsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchReturnableItems })

  const submitMutation = useMutation({
    mutationFn: submitReturnRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    submitReturnRequest: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    error: submitMutation.error,
  }
}
