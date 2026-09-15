// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchAnalytics, isAnalyticsLive } from '../services/analyticsService'
import { DASHBOARD_REFRESH_MS } from './useDashboardController'

export function useAnalyticsController(kind) {
  const [range, setRange] = useState('30d')
  const isLive = isAnalyticsLive(kind)

  const query = useQuery({
    queryKey: ['admin', 'analytics', kind, range],
    queryFn: () => fetchAnalytics(kind, range),
    placeholderData: keepPreviousData,
    // Only the endpoints backed by the reporting API are worth re-polling;
    // a fixture cannot change under the screen.
    refetchInterval: isLive ? DASHBOARD_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS / 2,
  })

  return {
    range,
    setRange,
    isLive,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    updatedAt: query.data?.updatedAt ?? null,
  }
}
