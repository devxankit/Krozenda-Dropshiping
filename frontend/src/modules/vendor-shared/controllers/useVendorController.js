import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchVendorKycDocs,
  fetchVendorOrders,
  fetchVendorProducts,
  fetchVendorSettlements,
  fetchVendorSettings,
  fetchVendorSummary,
} from '../services/vendorService'
import { useListController } from '../../admin/controllers/useListController'

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useVendorDashboardController() {
  const summary = useResource(['vendor', 'summary'], fetchVendorSummary)
  return { summary: summary.data, isLoading: summary.isLoading, isError: Boolean(summary.error), error: summary.error }
}

export function useVendorProductsController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'products'], queryFn: fetchVendorProducts })

  function addProduct(newProduct) {
    queryClient.setQueriesData({ queryKey: ['vendor', 'products'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: [newProduct, ...old.items],
        totalItems: old.totalItems + 1,
      }
    })
  }

  function updateStock(productId, stock) {
    queryClient.setQueriesData({ queryKey: ['vendor', 'products'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((p) =>
          p.id === productId ? { ...p, stock, status: stock > 0 ? 'active' : 'out_of_stock' } : p,
        ),
      }
    })
  }

  return { ...list, addProduct, updateStock }
}

export function useVendorOrdersController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'orders'], queryFn: fetchVendorOrders })

  function updateOrderStatus(subOrderId, forwardingStatus, awb = null) {
    queryClient.setQueriesData({ queryKey: ['vendor', 'orders'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((o) =>
          o.id === subOrderId ? { ...o, forwardingStatus, awb: awb || o.awb } : o,
        ),
      }
    })
  }

  return { ...list, updateOrderStatus }
}

export const useVendorSettlementsController = () =>
  useResource(['vendor', 'settlements'], fetchVendorSettlements)

export const useVendorKycDocsController = () =>
  useResource(['vendor', 'kyc-documents'], fetchVendorKycDocs)

export const useVendorSettingsController = () =>
  useResource(['vendor', 'settings'], fetchVendorSettings)
