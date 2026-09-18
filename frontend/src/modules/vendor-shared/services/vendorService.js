import { api } from '../../../lib/axios'
import { fetchResource, mutateResource } from '../../admin/services/mockTransport'
import {
  vendorAnalyticsSchema,
  vendorCouponListSchema,
  vendorCustomerListSchema,
  vendorEarningsEntryListSchema,
  vendorEarningsSummarySchema,
  vendorInventoryListSchema,
  vendorKycListSchema,
  vendorNotificationListSchema,
  vendorOrderListSchema,
  vendorPayoutListSchema,
  vendorOrderSchema,
  vendorProductListSchema,
  vendorProductSchema,
  vendorReturnListSchema,
  vendorReturnSchema,
  vendorReviewListSchema,
  vendorSettingsSchema,
  vendorSummarySchema,
} from '../schemas/vendorSchema'

// The Seller/Vendor Panel talks to a real, vendor-scoped backend end to end —
// every call below is `live: true` so it always hits the API regardless of
// VITE_USE_MOCKS (that flag still governs the Admin panel's unimplemented
// screens, but nothing here is a fixture-only stub anymore).

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchVendorSummary = () =>
  fetchResource({ path: '/vendor/summary', schema: vendorSummarySchema, live: true })

export const fetchVendorProducts = (query) =>
  fetchResource({ path: '/vendor/products', params: params(query), schema: vendorProductListSchema, live: true })

export async function createVendorProduct(formData) {
  const { data } = await api.post('/vendor/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return vendorProductSchema.parse(data.data)
}

export async function updateVendorProduct(id, formData) {
  const { data } = await api.put(`/vendor/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return vendorProductSchema.parse(data.data)
}

export async function deleteVendorProduct(id) {
  const { data } = await api.delete(`/vendor/products/${id}`)
  return data.data
}

export const fetchVendorInventory = (query) =>
  fetchResource({ path: '/vendor/inventory', params: params(query), schema: vendorInventoryListSchema, live: true })

export async function updateVendorStock(productId, stock) {
  const { data } = await api.patch(`/vendor/inventory/${productId}`, { stock })
  return data.data
}

export const fetchVendorOrders = (query) =>
  fetchResource({ path: '/vendor/orders', params: params(query), schema: vendorOrderListSchema, live: true })

export async function updateVendorOrderItemStatus(orderId, productId, payload) {
  const { data } = await api.patch(`/vendor/orders/${orderId}/items/${productId}/status`, payload)
  return vendorOrderSchema.parse(data.data)
}

export const fetchVendorCustomers = (query) =>
  fetchResource({ path: '/vendor/customers', params: params(query), schema: vendorCustomerListSchema, live: true })

export const fetchVendorCoupons = (query) =>
  fetchResource({ path: '/vendor/coupons', params: params(query), schema: vendorCouponListSchema, live: true })

export const createVendorCoupon = (body) =>
  mutateResource({ path: '/vendor/coupons', body, live: true })

export const updateVendorCouponStatus = (id, isActive) =>
  mutateResource({ method: 'patch', path: `/vendor/coupons/${id}/status`, body: { isActive }, live: true })

export const deleteVendorCoupon = (id) =>
  mutateResource({ method: 'delete', path: `/vendor/coupons/${id}`, live: true })

export const fetchVendorReviews = () =>
  fetchResource({ path: '/vendor/reviews', schema: vendorReviewListSchema, live: true })

export const replyToVendorReview = (id, message) =>
  mutateResource({ path: `/vendor/reviews/${id}/reply`, body: { message }, live: true })

export const fetchVendorReturns = () =>
  fetchResource({ path: '/vendor/returns', schema: vendorReturnListSchema, live: true })

// Advisory only. The seller says what they think should happen and why; the
// request's status does not move and no money changes hands. Admin decides —
// see adminReturnController.decideReturnRequest.
export async function recommendOnVendorReturn(id, { decision, note }) {
  const { data } = await api.post(`/vendor/returns/${id}/recommend`, { decision, note })
  return vendorReturnSchema.parse(data.data)
}

export const fetchVendorEarningsSummary = () =>
  fetchResource({ path: '/vendor/earnings/summary', schema: vendorEarningsSummarySchema, live: true })

export const fetchVendorEarningsEntries = () =>
  fetchResource({ path: '/vendor/earnings/transactions', schema: vendorEarningsEntryListSchema, live: true })

export const fetchVendorPayouts = () =>
  fetchResource({ path: '/vendor/earnings/payouts', schema: vendorPayoutListSchema, live: true })

export const fetchVendorAnalytics = () =>
  fetchResource({ path: '/vendor/analytics/summary', schema: vendorAnalyticsSchema, live: true })

export const fetchVendorNotifications = () =>
  fetchResource({ path: '/vendor/notifications', schema: vendorNotificationListSchema, live: true })

export async function markVendorNotificationRead(id) {
  const { data } = await api.patch(`/vendor/notifications/${id}/read`)
  return data.data
}

export async function markAllVendorNotificationsRead() {
  const { data } = await api.patch('/vendor/notifications/read-all')
  return data
}

export const fetchVendorKycDocs = () =>
  fetchResource({ path: '/vendor/documents', schema: vendorKycListSchema, live: true })

export async function uploadVendorKycDocument(formData) {
  const { data } = await api.post('/vendor/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data.data
}

export async function deleteVendorKycDocument(id) {
  const { data } = await api.delete(`/vendor/documents/${id}`)
  return data.data
}

export const fetchVendorSettings = () =>
  fetchResource({ path: '/vendor/settings', schema: vendorSettingsSchema, live: true })

export const updateVendorSettings = (body) =>
  mutateResource({ method: 'put', path: '/vendor/settings', body, live: true })

// Sellers can propose new categories/brands, but they stay PENDING (hidden
// from the storefront and every other seller) until an admin approves them —
// see CategoriesPage and backend vendorCatalogController.
export async function fetchVendorCategories() {
  const { data } = await api.get('/vendor/catalog/categories')
  return data.data.items
}

export async function createVendorCategory(formData) {
  const { data } = await api.post('/vendor/catalog/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data.data
}

export async function fetchVendorBrands() {
  const { data } = await api.get('/vendor/catalog/brands')
  return data.data.items
}

export async function createVendorBrand(formData) {
  const { data } = await api.post('/vendor/catalog/brands', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data.data
}

export async function fetchVendorTickets() {
  const { data } = await api.get('/vendor/tickets')
  return data.data
}

export async function fetchVendorTicket(id) {
  const { data } = await api.get(`/vendor/tickets/${id}`)
  return data.data
}

export async function createVendorTicket(body) {
  const { data } = await api.post('/vendor/tickets', body)
  return data.data
}

export async function addVendorTicketMessage(id, message) {
  const { data } = await api.post(`/vendor/tickets/${id}/messages`, { message })
  return data.data
}

// Real backend call — see registerPushToken() in VendorLoginPage. The
// endpoint is shared with the buyer app; the vendor JWT is what files the
// device under this vendor.
export async function registerVendorFcmToken(token, deviceType = 'web') {
  const { data } = await api.post('/fcm-token', { token, deviceType })
  return data
}
