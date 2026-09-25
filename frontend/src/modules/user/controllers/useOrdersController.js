// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOrders, fetchOrder, fetchOrderInvoice, fetchOrderTracking, cancelOrder } from '../services/orderService'

// OrderListScreen. Server-paginated: this previously fetched every order the
// buyer had ever placed, in full, on every visit to the Orders tab.
export function useOrdersController({ status, page = 1, limit = 20 } = {}) {
  const query = useQuery({
    queryKey: ['user', 'orders', { status: status || 'all', page, limit }],
    queryFn: ({ signal }) => fetchOrders({ status, page, limit }, { signal }),
    placeholderData: keepPreviousData,
  })

  return {
    orders: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// OrderDetailsScreen / TrackShipmentScreen / Invoice screens.
// The parcels for one order. Separate from useOrderController because an order
// can exist for days before any parcel does, and the two load independently.
export function useOrderTrackingController(orderId) {
  const query = useQuery({
    queryKey: ['user', 'order', orderId, 'tracking'],
    queryFn: ({ signal }) => fetchOrderTracking(orderId, { signal }),
    enabled: Boolean(orderId),
  })
  return {
    tracking: query.data,
    parcels: query.data?.parcels ?? [],
    hasShipments: query.data?.hasShipments ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useOrderController(orderId) {
  const query = useQuery({
    queryKey: ['user', 'order', orderId],
    queryFn: ({ signal }) => fetchOrder(orderId, { signal }),
    enabled: Boolean(orderId),
  })
  return {
    order: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// The order's invoice set: one tax invoice per supplier (Krozenda / each
// seller), each carrying that supplier's GSTIN.
export function useOrderInvoiceController(orderId) {
  const query = useQuery({
    queryKey: ['user', 'order', orderId, 'invoice'],
    queryFn: ({ signal }) => fetchOrderInvoice(orderId, { signal }),
    enabled: Boolean(orderId),
  })
  return { invoice: query.data, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}

// Cancelling restores stock and may trigger a refund, so both the list and the
// detail view are invalidated — otherwise the Orders tab keeps showing the
// order as PENDING until something else happens to refetch it.
export function useCancelOrderController(orderId) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => cancelOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'orders'] })
      queryClient.invalidateQueries({ queryKey: ['user', 'order', orderId] })
    },
  })

  return {
    cancelOrder: mutation.mutateAsync,
    isCancelling: mutation.isPending,
    error: mutation.error,
  }
}
