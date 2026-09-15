// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { createOrder, fetchOrderDetail, fetchOrders, updateOrderStatus } from '../services/orderService'
import { useAdminMutation } from './useAdminMutation'
import { useListController } from './useListController'

export function useOrderListController() {
  return useListController({
    queryKey: ['admin', 'orders'],
    queryFn: fetchOrders,
    defaultSort: { key: 'createdAt', direction: 'desc' },
    defaultRowsPerPage: 10,
  })
}

export const useOrderWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: createOrder,
    invalidate: [['admin', 'orders']],
    success: (order) => `Order ${order.id.slice(-8).toUpperCase()} created`,
    onDone: onSaved,
  }),
})

export const useOrderStatusController = () =>
  useAdminMutation({
    mutationFn: updateOrderStatus,
    invalidate: [['admin', 'orders']],
    success: () => 'Order status updated',
  })

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
