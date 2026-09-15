// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchOrders, fetchOrder } from '../services/orderService'

// OrderListScreen.
export function useOrdersController(status) {
  const query = useQuery({ queryKey: ['user', 'orders', status || 'all'], queryFn: () => fetchOrders(status) })
  return { orders: query.data || [], isLoading: query.isLoading }
}

// OrderDetailsScreen / TrackShipmentScreen / Invoice screens.
export function useOrderController(orderId) {
  const query = useQuery({
    queryKey: ['user', 'orders', orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: Boolean(orderId),
  })
  return { order: query.data, isLoading: query.isLoading, isError: query.isError }
}
