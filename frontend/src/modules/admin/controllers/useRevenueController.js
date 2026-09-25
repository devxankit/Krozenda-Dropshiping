// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRevenue, fetchSellerRevenue } from '../services/analyticsService'
import { DASHBOARD_REFRESH_MS } from './useDashboardController'

// Same contract as useAnalyticsController, so the page can sit in the shared
// AnalyticsShell (range picker, refresh, loading/error states).
export const REVENUE_CHANNELS = Object.freeze([
  { id: 'all', label: 'All channels' },
  { id: 'own_stock', label: 'Own stock' },
  { id: 'cj', label: 'CJ Dropshipping' },
  { id: 'sellers', label: 'Sellers' },
])

export function useRevenueController() {
  const [range, setRange] = useState('30d')
  // Which channel the figures are for. 'all' is the combined view; any other
  // shows that channel alone — its own KPIs, chart line and detail.
  const [channel, setChannel] = useState('all')
  const query = useQuery({
    queryKey: ['admin', 'revenue', range],
    queryFn: () => fetchRevenue(range),
    placeholderData: keepPreviousData,
    refetchInterval: DASHBOARD_REFRESH_MS,
    refetchIntervalInBackground: false,
    staleTime: DASHBOARD_REFRESH_MS / 2,
  })

  const data = useMemo(() => {
    if (!query.data || channel === 'all') return query.data
    return { ...query.data, kpis: query.data.channelKpis[channel] || query.data.kpis }
  }, [query.data, channel])

  return {
    range,
    setRange,
    channel,
    setChannel,
    isLive: true,
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    updatedAt: query.data?.updatedAt ?? null,
  }
}

// One seller's drill-down, for the window the page is showing.
export function useSellerRevenueController(sellerId, range) {
  const query = useQuery({
    queryKey: ['admin', 'revenue', 'seller', sellerId, range],
    queryFn: () => fetchSellerRevenue(sellerId, range),
    enabled: Boolean(sellerId),
    placeholderData: keepPreviousData,
  })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
