// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into. A controller
// returns plain data + handlers — no JSX here.

import { useQuery } from '@tanstack/react-query'
import { fetchVendorDashboardSummary } from '../services/dashboardService'

export function useVendorDashboardController() {
  const query = useQuery({
    queryKey: ['vendor', 'dashboard-summary'],
    queryFn: fetchVendorDashboardSummary,
  })

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
