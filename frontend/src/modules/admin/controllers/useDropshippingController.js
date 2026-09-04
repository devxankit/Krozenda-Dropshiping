// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDropshipMarginRules,
  fetchDropshipOverview,
  fetchDropshipPartners,
  fetchDropshipProducts,
  fetchForwardedOrders,
} from '../services/dropshippingService'
import { useListController } from './useListController'

export function useDropshipPartnersController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['admin', 'dropship', 'partners'], queryFn: fetchDropshipPartners })

  function addPartner(newPartner) {
    queryClient.setQueriesData({ queryKey: ['admin', 'dropship', 'partners'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: [newPartner, ...old.items],
        totalItems: old.totalItems + 1,
      }
    })
  }

  function togglePartnerStatus(partnerId, status) {
    queryClient.setQueriesData({ queryKey: ['admin', 'dropship', 'partners'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((item) => (item.id === partnerId ? { ...item, status } : item)),
      }
    })
  }

  return { ...list, addPartner, togglePartnerStatus }
}

export function useDropshipProductsController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['admin', 'dropship', 'products'], queryFn: fetchDropshipProducts })

  function overrideProductMargin(productId, newSellingPrice, marginPct) {
    queryClient.setQueriesData({ queryKey: ['admin', 'dropship', 'products'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((item) =>
          item.id === productId
            ? { ...item, sellingPrice: newSellingPrice, marginPct, overrideActive: true }
            : item,
        ),
      }
    })
  }

  return { ...list, overrideProductMargin }
}

export function useDropshipOrdersController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['admin', 'dropship', 'orders'], queryFn: fetchForwardedOrders })

  function reassignOrder(subOrderId, partnerName, forwardingStatus) {
    queryClient.setQueriesData({ queryKey: ['admin', 'dropship', 'orders'] }, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((item) =>
          item.id === subOrderId ? { ...item, partnerName, forwardingStatus } : item,
        ),
      }
    })
  }

  return { ...list, reassignOrder }
}

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useDropshipOverviewController = () =>
  useResource(['admin', 'dropship', 'overview'], fetchDropshipOverview)

export function useDropshipMarginsController() {
  const queryClient = useQueryClient()
  const res = useResource(['admin', 'dropship', 'margins'], fetchDropshipMarginRules)

  function addRule(newRule) {
    queryClient.setQueryData(['admin', 'dropship', 'margins'], (old) => {
      if (!old) return [newRule]
      return [newRule, ...old]
    })
  }

  return { ...res, addRule }
}
