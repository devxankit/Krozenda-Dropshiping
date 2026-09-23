// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '../stores/toastStore'

/**
 * Every write in the panel goes through here, so all of them invalidate,
 * announce themselves and report failure the same way. A screen supplies
 * what changed; it does not re-implement any of that.
 *
 * `invalidate` takes query-key prefixes. react-query matches prefixes, so
 * ['admin', 'finance'] refreshes every finance list and statement at once —
 * which is what a posting actually affects.
 *
 * @param {object}   options
 * @param {Function} options.mutationFn   Service call.
 * @param {Array[]}  [options.invalidate] Query-key prefixes to refetch.
 * @param {string|Function} [options.success] Toast title, or (data, vars) => title.
 * @param {Function} [options.describe]   (data, vars) => toast description.
 * @param {Function} [options.onDone]     Runs after invalidation, e.g. close a drawer.
 */
export function useAdminMutation({
  mutationFn,
  invalidate = [],
  success,
  describe,
  onDone,
  onFail,
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      for (const key of invalidate) {
        queryClient.invalidateQueries({ queryKey: key })
      }

      const title = typeof success === 'function' ? success(data, variables) : success
      if (title) toast.success(title, describe?.(data, variables))

      onDone?.(data, variables)
    },
    onError: (error) => {
      toast.error('That did not save', error)
      onFail?.(error)
    },
  })

  return {
    run: mutation.mutate,
    runAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
