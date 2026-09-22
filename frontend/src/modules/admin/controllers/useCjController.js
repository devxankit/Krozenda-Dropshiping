// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCjSettings,
  connectCj,
  disconnectCj,
  testCjConnection,
  refreshCjToken,
  fetchCjDashboard,
  fetchCjOrders,
  fetchCjShipments,
  fetchCjDisputes,
  createCjDispute,
  cancelCjDispute,
  refreshCjOrderStatus,
  cancelCjOrder,
  refreshCjShipmentTracking,
  fetchCjSyncLogs,
  runCjSyncNow,
  searchCjCatalogue,
  fetchCjCategories,
  fetchCjProductDetail,
  onboardCjProduct,
  fetchOnboardedCjProducts,
  fetchCjProductCategorySummary,
  updateCjMarkupSettings,
  updateCjDropshippingVisibility,
  bulkAdjustCjPricing,
  bulkOnboardCjProducts,
} from '../services/cjService'
import { fetchCategoryTree } from '../services/catalogService'

const SETTINGS_KEY = ['admin', 'cj', 'settings']
const DASHBOARD_KEY = ['admin', 'cj', 'dashboard']

// Connect/disconnect/test/refresh/markup — no draft/save shape like the toggle
// settings screens, since there's no "field" to edit, only actions to fire.
export function useCjSettingsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchCjSettings })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })

  const connectMutation = useMutation({ mutationFn: connectCj, onSuccess: invalidate })
  const disconnectMutation = useMutation({ mutationFn: disconnectCj, onSuccess: invalidate })
  const testMutation = useMutation({ mutationFn: testCjConnection, onSuccess: invalidate })
  const refreshMutation = useMutation({ mutationFn: refreshCjToken, onSuccess: invalidate })
  const markupMutation = useMutation({ mutationFn: updateCjMarkupSettings, onSuccess: invalidate })
  const visibilityMutation = useMutation({ mutationFn: updateCjDropshippingVisibility, onSuccess: invalidate })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error,

    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    testConnection: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
    testResult: testMutation.data,

    refreshToken: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,

    updateMarkupSettings: markupMutation.mutateAsync,
    isUpdatingMarkup: markupMutation.isPending,
    updateMarkupError: markupMutation.error,

    updateVisibility: visibilityMutation.mutateAsync,
    isUpdatingVisibility: visibilityMutation.isPending,
    updateVisibilityError: visibilityMutation.error,
  }
}

export function useCjDashboardController() {
  const query = useQuery({ queryKey: DASHBOARD_KEY, queryFn: fetchCjDashboard, refetchInterval: 60_000 })
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

// Live search — no caching key beyond the params themselves, since a stale
// CJ search result is actively wrong (master plan §2: never a bulk import,
// always live).
export function useCjCatalogueSearchController(params, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['admin', 'cj', 'catalogue', params],
    queryFn: () => searchCjCatalogue(params),
    enabled,
    keepPreviousData: true,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCjCategoriesController() {
  const query = useQuery({
    queryKey: ['admin', 'cj', 'categories'],
    queryFn: fetchCjCategories,
    staleTime: 5 * 60_000, // category tree is slow-changing, per master plan §5
  })
  return { data: query.data ?? [], isLoading: query.isLoading, error: query.error }
}

export function useCjProductDetailController(productId) {
  const query = useQuery({
    queryKey: ['admin', 'cj', 'catalogue', 'detail', productId],
    queryFn: () => fetchCjProductDetail(productId),
    enabled: !!productId,
  })
  return { data: query.data, isLoading: query.isLoading, error: query.error }
}

export function useCjOnboardingController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: onboardCjProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'products'] }),
  })
  return { onboard: mutation.mutateAsync, isOnboarding: mutation.isPending, error: mutation.error }
}

export function useCjBulkOnboardingController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: bulkOnboardCjProducts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })
    },
  })
  return {
    bulkOnboard: mutation.mutateAsync,
    isBulkOnboarding: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  }
}

export function useCjOnboardedProductsController(params) {
  const query = useQuery({ queryKey: ['admin', 'cj', 'products', params], queryFn: () => fetchOnboardedCjProducts(params) })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useCjProductCategorySummaryController() {
  const query = useQuery({
    queryKey: ['admin', 'cj', 'products', 'category-summary'],
    queryFn: fetchCjProductCategorySummary,
  })
  return { categories: query.data || [], isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useCjBulkPricingController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: bulkAdjustCjPricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'products'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'dashboard'] })
    },
  })
  return {
    bulkAdjust: mutation.mutateAsync,
    isAdjusting: mutation.isPending,
    error: mutation.error,
  }
}

export function useCjOrdersController(params) {
  const query = useQuery({ queryKey: ['admin', 'cj', 'orders', params], queryFn: () => fetchCjOrders(params) })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useCjShipmentsController(params) {
  const query = useQuery({ queryKey: ['admin', 'cj', 'shipments', params], queryFn: () => fetchCjShipments(params) })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useCjDisputesController(params) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'cj', 'disputes', params], queryFn: () => fetchCjDisputes(params) })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'disputes'] })

  const createMutation = useMutation({ mutationFn: createCjDispute, onSuccess: invalidate })
  const cancelMutation = useMutation({ mutationFn: cancelCjDispute, onSuccess: invalidate })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    createDispute: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    cancelDispute: cancelMutation.mutateAsync,
  }
}

// Krozenda's own category list, for the onboarding modal's category-mapping
// select. A thin wrapper rather than a page importing catalogService
// directly, per this codebase's controller/service layering rule.
export function useKrozendaCategoriesController() {
  // fetchCategoryTree() resolves { items, stats } (categoryController's
  // listCategories shape) — this controller's job is to hand pages a plain
  // array, so nothing downstream has to know that shape.
  const query = useQuery({ queryKey: ['admin', 'catalog', 'categories', 'flat'], queryFn: fetchCategoryTree })
  return { data: query.data?.items ?? [], isLoading: query.isLoading, error: query.error }
}

export function useCjOrderActionsController() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'orders'] })
  const refreshMutation = useMutation({ mutationFn: refreshCjOrderStatus, onSuccess: invalidate })
  const cancelMutation = useMutation({ mutationFn: cancelCjOrder, onSuccess: invalidate })
  return {
    refreshStatus: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    cancelOrder: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  }
}

export function useCjShipmentActionsController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: refreshCjShipmentTracking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'shipments'] }),
  })
  return { refreshTracking: mutation.mutateAsync, isRefreshing: mutation.isPending }
}

export function useCjSyncLogsController(params) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'cj', 'sync-logs', params], queryFn: () => fetchCjSyncLogs(params) })
  const runNowMutation = useMutation({
    mutationFn: runCjSyncNow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cj', 'sync-logs'] }),
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    runNow: runNowMutation.mutateAsync,
    isRunning: runNowMutation.isPending,
  }
}
