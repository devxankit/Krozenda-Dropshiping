// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchAdminDashboardSummary } from '../services/dashboardService'

export function useDashboardController() {
  const query = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn: fetchAdminDashboardSummary,
  })

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}
