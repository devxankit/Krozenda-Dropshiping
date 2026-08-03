// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchAuthSessionStatus } from '../services/dashboardService'

export function useDashboardController() {
  const query = useQuery({
    queryKey: ['auth', 'session-status'],
    queryFn: fetchAuthSessionStatus,
  })

  return {
    session: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
