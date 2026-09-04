// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAdminDashboardSummary, fetchDashboard } from '../services/dashboardService'

export const DASHBOARD_RANGES = Object.freeze([
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'fy', label: 'This financial year' },
])

export function useDashboardController() {
  const [range, setRange] = useState('30d')

  const query = useQuery({
    queryKey: ['admin', 'dashboard', range],
    queryFn: () => fetchDashboard(range),
  })

  return {
    range,
    setRange,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// Kept for the interim summary endpoint; the seller and partner panels use
// the same four counters.
export function useDashboardSummaryController() {
  const query = useQuery({
    queryKey: ['admin', 'dashboard-summary'],
    queryFn: fetchAdminDashboardSummary,
  })

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
