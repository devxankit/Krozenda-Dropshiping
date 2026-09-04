// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAnalytics } from '../services/analyticsService'

export function useAnalyticsController(kind) {
  const [range, setRange] = useState('30d')

  const query = useQuery({
    queryKey: ['admin', 'analytics', kind, range],
    queryFn: () => fetchAnalytics(kind, range),
  })

  return {
    range,
    setRange,
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
