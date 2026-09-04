// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchOrderDetail, fetchOrders } from '../services/orderService'
import { useListController } from './useListController'

export function useOrderListController() {
  return useListController({
    queryKey: ['admin', 'orders'],
    queryFn: fetchOrders,
    defaultSort: { key: 'placedAt', direction: 'desc' },
  })
}

export function useOrderDetailController(orderId) {
  const query = useQuery({
    queryKey: ['admin', 'orders', orderId],
    queryFn: () => fetchOrderDetail(orderId),
    enabled: Boolean(orderId),
  })

  return {
    order: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
