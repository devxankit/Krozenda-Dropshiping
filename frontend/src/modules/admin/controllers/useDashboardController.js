// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchAdminDashboardSummary, fetchDashboard } from '../services/dashboardService'

export const DASHBOARD_RANGES = Object.freeze([
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'fy', label: 'This financial year' },
])

// The dashboard is a wall screen as often as it is a page, so it re-reads
// itself on a timer rather than waiting to be reloaded. Only while the tab is
// visible — a backgrounded tab polling the API all afternoon is just load.
export const DASHBOARD_REFRESH_MS = 60_000

export function useDashboardController() {
  const [range, setRange] = useState('30d')

  const query = useQuery({
    queryKey: ['admin', 'dashboard', range],
    queryFn: () => fetchDashboard(range),
    // Changing the range keeps the window already on screen until the new one
    // lands, so the whole page does not collapse into a skeleton on a click.
    placeholderData: keepPreviousData,
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS / 2,
  })

  return {
    range,
    setRange,
    data: query.data,
    isLoading: query.isLoading,
    // True on a background refresh too — the header spins its refresh control
    // instead of tearing the page down.
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    // When the server computed the payload, not when react-query cached it.
    updatedAt: query.data?.updatedAt ?? null,
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
