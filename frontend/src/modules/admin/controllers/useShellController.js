// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchShellSummary } from '../services/shellService'

const EMPTY_COUNTS = Object.freeze({
  productApprovals: 0,
  openReturns: 0,
  pendingKyc: 0,
  failedPayouts: 0,
})

// Feeds the sidebar badges and the notification tray. The shell renders on
// every screen, so this must degrade to zeroes rather than block or throw —
// a failed counter request is not a reason to lose the navigation.
export function useShellController() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['admin', 'shell-summary'],
    queryFn: fetchShellSummary,
    staleTime: 60_000,
  })

  function markAllRead() {
    queryClient.setQueryData(['admin', 'shell-summary'], (current) =>
      current
        ? {
            ...current,
            notifications: current.notifications.map((item) => ({ ...item, read: true })),
          }
        : current,
    )
  }

  return {
    counts: query.data?.counts ?? EMPTY_COUNTS,
    notifications: query.data?.notifications ?? [],
    isLoading: query.isLoading,
    markAllRead,
  }
}
