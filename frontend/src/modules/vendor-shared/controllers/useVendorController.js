import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addVendorTicketMessage,
  createVendorBrand,
  createVendorCategory,
  createVendorCoupon,
  createVendorProduct,
  createVendorTicket,
  fetchVendorBrands,
  fetchVendorCategories,
  fetchVendorTicket,
  fetchVendorTickets,
  deleteVendorCoupon,
  deleteVendorKycDocument,
  fetchVendorAnalytics,
  fetchVendorCoupons,
  fetchVendorCustomers,
  fetchVendorEarningsEntries,
  fetchVendorEarningsSummary,
  fetchVendorInventory,
  fetchVendorKycDocs,
  fetchVendorNotifications,
  fetchVendorOrders,
  fetchVendorProducts,
  fetchVendorReturns,
  fetchVendorReviews,
  fetchVendorSettings,
  fetchVendorSummary,
  markAllVendorNotificationsRead,
  markVendorNotificationRead,
  registerVendorFcmToken,
  replyToVendorReview,
  updateVendorCouponStatus,
  updateVendorOrderItemStatus,
  updateVendorProduct,
  updateVendorSettings,
  updateVendorStock,
  uploadVendorKycDocument,
  deleteVendorProduct,
} from '../services/vendorService'
import { fetchVendorProfile, loginVendor, requestVendorPasswordReset, resetVendorPassword, updateVendorProfile } from '../services/authService'
import { useListController } from '../../admin/controllers/useListController'
import { requestPushToken } from '../../../lib/firebase'

export function useVendorLoginController() {
  const mutation = useMutation({ mutationFn: loginVendor })
  return { login: mutation.mutateAsync, isSubmitting: mutation.isPending, error: mutation.error }
}

export function useVendorForgotPasswordController() {
  const mutation = useMutation({ mutationFn: requestVendorPasswordReset })
  return { requestReset: mutation.mutateAsync, isSubmitting: mutation.isPending, error: mutation.error }
}

export function useVendorResetPasswordController() {
  const mutation = useMutation({ mutationFn: resetVendorPassword })
  return { resetPassword: mutation.mutateAsync, isSubmitting: mutation.isPending, error: mutation.error }
}

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, isError: Boolean(query.error), error: query.error, refetch: query.refetch }
}

export function useVendorDashboardController() {
  return useResource(['vendor', 'summary'], fetchVendorSummary)
}

export function useVendorProductsController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'products'], queryFn: fetchVendorProducts })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vendor', 'products'] })

  const createMutation = useMutation({ mutationFn: createVendorProduct, onSuccess: invalidate })
  const updateMutation = useMutation({ mutationFn: ({ id, formData }) => updateVendorProduct(id, formData), onSuccess: invalidate })
  const deleteMutation = useMutation({ mutationFn: deleteVendorProduct, onSuccess: invalidate })
  const stockMutation = useMutation({ mutationFn: ({ id, stock }) => updateVendorStock(id, stock), onSuccess: invalidate })

  return {
    ...list,
    addProduct: createMutation.mutateAsync,
    editProduct: updateMutation.mutateAsync,
    removeProduct: deleteMutation.mutateAsync,
    updateStock: (id, stock) => stockMutation.mutateAsync({ id, stock }),
  }
}

export function useVendorInventoryController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'inventory'], queryFn: fetchVendorInventory })
  const stockMutation = useMutation({
    mutationFn: ({ id, stock }) => updateVendorStock(id, stock),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'inventory'] }),
  })
  return { ...list, updateStock: (id, stock) => stockMutation.mutateAsync({ id, stock }) }
}

export function useVendorOrdersController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'orders'], queryFn: fetchVendorOrders })
  const statusMutation = useMutation({
    mutationFn: ({ orderId, productId, payload }) => updateVendorOrderItemStatus(orderId, productId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'orders'] }),
  })
  return {
    ...list,
    updateItemStatus: (orderId, productId, payload) => statusMutation.mutateAsync({ orderId, productId, payload }),
  }
}

export function useVendorCatalogCategoriesController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'catalog', 'categories'], queryFn: fetchVendorCategories })
  const createMutation = useMutation({
    mutationFn: createVendorCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'catalog', 'categories'] }),
  })
  return { items: query.data ?? [], isLoading: query.isLoading, createCategory: createMutation.mutateAsync }
}

export function useVendorCatalogBrandsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'catalog', 'brands'], queryFn: fetchVendorBrands })
  const createMutation = useMutation({
    mutationFn: createVendorBrand,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'catalog', 'brands'] }),
  })
  return { items: query.data ?? [], isLoading: query.isLoading, createBrand: createMutation.mutateAsync }
}

// Used by CouponsPage to build the "applies to" product picker — only needs
// the seller's own active products, one page's worth.
export function useVendorProductsPickerController(enabled) {
  const query = useQuery({
    queryKey: ['vendor', 'products', 'picker'],
    queryFn: () => fetchVendorProducts({ tab: 'active', filters: {}, page: 1, rowsPerPage: 100 }),
    enabled,
  })
  return { items: query.data?.items ?? [] }
}

export function useVendorCustomersController() {
  return useListController({ queryKey: ['vendor', 'customers'], queryFn: fetchVendorCustomers })
}

export function useVendorCouponsController() {
  const queryClient = useQueryClient()
  const list = useListController({ queryKey: ['vendor', 'coupons'], queryFn: fetchVendorCoupons })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vendor', 'coupons'] })

  const createMutation = useMutation({ mutationFn: createVendorCoupon, onSuccess: invalidate })
  const statusMutation = useMutation({ mutationFn: ({ id, isActive }) => updateVendorCouponStatus(id, isActive), onSuccess: invalidate })
  const deleteMutation = useMutation({ mutationFn: deleteVendorCoupon, onSuccess: invalidate })

  return {
    ...list,
    createCoupon: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    toggleStatus: (id, isActive) => statusMutation.mutateAsync({ id, isActive }),
    deleteCoupon: deleteMutation.mutateAsync,
  }
}

export function useVendorReviewsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'reviews'], queryFn: fetchVendorReviews })
  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => replyToVendorReview(id, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'reviews'] }),
  })
  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    reply: (id, message) => replyMutation.mutateAsync({ id, message }),
  }
}

export function useVendorReturnsController() {
  const query = useQuery({ queryKey: ['vendor', 'returns'], queryFn: fetchVendorReturns })
  return { items: query.data?.items ?? [], isLoading: query.isLoading, error: query.error }
}

export function useVendorEarningsController() {
  const summary = useResource(['vendor', 'earnings', 'summary'], fetchVendorEarningsSummary)
  const entries = useResource(['vendor', 'earnings', 'entries'], fetchVendorEarningsEntries)
  return {
    summary: summary.data,
    entries: entries.data?.items ?? [],
    isLoading: summary.isLoading || entries.isLoading,
  }
}

export function useVendorAnalyticsController() {
  return useResource(['vendor', 'analytics'], fetchVendorAnalytics)
}

export function useVendorNotificationsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'notifications'], queryFn: fetchVendorNotifications })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['vendor', 'notifications'] })
  const readMutation = useMutation({ mutationFn: markVendorNotificationRead, onSuccess: invalidate })
  const readAllMutation = useMutation({ mutationFn: markAllVendorNotificationsRead, onSuccess: invalidate })

  return {
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markRead: readMutation.mutateAsync,
    markAllRead: readAllMutation.mutateAsync,
  }
}

export function useVendorTicketsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'tickets'], queryFn: fetchVendorTickets })
  const createMutation = useMutation({
    mutationFn: createVendorTicket,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'tickets'] }),
  })
  return {
    items: query.data?.items ?? [],
    counts: query.data?.counts ?? {},
    isLoading: query.isLoading,
    createTicket: createMutation.mutateAsync,
  }
}

export function useVendorTicketController(id) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['vendor', 'ticket', id], queryFn: () => fetchVendorTicket(id), enabled: Boolean(id) })
  const replyMutation = useMutation({
    mutationFn: (message) => addVendorTicketMessage(id, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', 'ticket', id] })
      queryClient.invalidateQueries({ queryKey: ['vendor', 'tickets'] })
    },
  })
  return { ticket: query.data, isLoading: query.isLoading, reply: replyMutation.mutateAsync }
}

export const useVendorKycDocsController = () => useResource(['vendor', 'kyc-documents'], fetchVendorKycDocs)

export function useVendorUploadKycController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: uploadVendorKycDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'kyc-documents'] }),
  })
  return { upload: mutation.mutateAsync, isSubmitting: mutation.isPending }
}

export function useVendorDeleteKycController() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: deleteVendorKycDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'kyc-documents'] }),
  })
  return { remove: mutation.mutateAsync }
}

export function useVendorProfileController() {
  const queryClient = useQueryClient()
  const query = useResource(['vendor', 'profile'], fetchVendorProfile)
  const mutation = useMutation({
    mutationFn: updateVendorProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'profile'] }),
  })
  return { ...query, updateProfile: mutation.mutateAsync, isSubmitting: mutation.isPending }
}

export function useVendorSettingsController() {
  const queryClient = useQueryClient()
  const query = useResource(['vendor', 'settings'], fetchVendorSettings)
  const mutation = useMutation({
    mutationFn: updateVendorSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendor', 'settings'] }),
  })
  return { ...query, updateSettings: mutation.mutateAsync, isSubmitting: mutation.isPending }
}

// Best-effort, same reasoning as the buyer app's registerPushToken in
// lib/notificationStore.js — a declined permission or unsupported browser
// must never block sign-in, so failures are swallowed.
export function useVendorPushRegistration() {
  return async function registerPushToken() {
    try {
      const token = await requestPushToken()
      if (token) await registerVendorFcmToken(token)
    } catch {
      // Ignored — see comment above.
    }
  }
}
