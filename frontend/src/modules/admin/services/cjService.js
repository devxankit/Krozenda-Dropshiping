import { api } from '../../../lib/axios'

// Live only, same rule as paymentSettingsService: CJ credentials and
// connection state are real backend state, never a fixture — a mocked
// "Connected" badge here would be actively misleading.

export async function fetchCjSettings() {
  const { data } = await api.get('/admin/cj/settings')
  return data.data
}

export async function connectCj(body) {
  const { data } = await api.post('/admin/cj/settings/connect', body)
  return data.data
}

export async function disconnectCj() {
  const { data } = await api.post('/admin/cj/settings/disconnect')
  return data.data
}

export async function testCjConnection() {
  const { data } = await api.post('/admin/cj/settings/test-connection')
  return data
}

export async function refreshCjToken() {
  const { data } = await api.post('/admin/cj/settings/refresh-token')
  return data
}

export async function fetchCjDashboard() {
  const { data } = await api.get('/admin/cj/dashboard')
  return data.data
}

export async function fetchCjBalance() {
  const { data } = await api.get('/admin/cj/balance')
  return data.data
}

export async function searchCjCatalogue(params) {
  const { data } = await api.get('/admin/cj/catalogue', { params })
  return data.data
}

export async function fetchCjCategories() {
  const { data } = await api.get('/admin/cj/catalogue/categories')
  return data.data
}

export async function fetchCjProductDetail(productId) {
  const { data } = await api.get(`/admin/cj/catalogue/${productId}`)
  return data.data
}

export async function onboardCjProduct(body) {
  const { data } = await api.post('/admin/cj/products/onboard', body)
  return data.data
}

export async function bulkOnboardCjProducts(body) {
  const { data } = await api.post('/admin/cj/products/bulk-onboard', body, {
    timeout: 300000,
  })
  return data
}

export async function updateCjMarkupSettings(body) {
  const { data } = await api.post('/admin/cj/settings/markup', body)
  return data.data
}

export async function updateCjDropshippingVisibility(body) {
  const { data } = await api.post('/admin/cj/settings/visibility', body)
  return data.data
}

export async function bulkAdjustCjPricing(body) {
  const { data } = await api.post('/admin/cj/products/bulk-pricing', body)
  return data
}

export async function fetchOnboardedCjProducts(params) {
  const { data } = await api.get('/admin/cj/products', { params })
  return data.data
}

// Krozenda categories that hold at least one onboarded CJ product, with a
// count each. Backs the standalone Category screen's cards and the Products
// screen's category filter.
export async function fetchCjProductCategorySummary() {
  const { data } = await api.get('/admin/cj/products/category-summary')
  return data.data.categories
}

export async function fetchCjCategoryMappings() {
  const { data } = await api.get('/admin/cj/category-mappings')
  return data.data
}

export async function saveCjCategoryMapping(body) {
  const { data } = await api.post('/admin/cj/category-mappings', body)
  return data.data
}

export async function fetchCjOrders(params) {
  const { data } = await api.get('/admin/cj/orders', { params })
  return data.data
}

export async function fetchCjShipments(params) {
  const { data } = await api.get('/admin/cj/shipments', { params })
  return data.data
}

export async function fetchCjDisputes(params) {
  const { data } = await api.get('/admin/cj/disputes', { params })
  return data.data
}

export async function createCjDispute(body) {
  const { data } = await api.post('/admin/cj/disputes', body)
  return data.data
}

export async function cancelCjDispute(id) {
  const { data } = await api.post(`/admin/cj/disputes/${id}/cancel`)
  return data.data
}

export async function refreshCjOrderStatus(id) {
  const { data } = await api.post(`/admin/cj/orders/${id}/refresh-status`)
  return data.data
}

export async function cancelCjOrder(id) {
  const { data } = await api.post(`/admin/cj/orders/${id}/cancel`)
  return data.data
}

export async function refreshCjShipmentTracking(id) {
  const { data } = await api.post(`/admin/cj/shipments/${id}/refresh-tracking`)
  return data.data
}

export async function fetchCjSyncLogs(params) {
  const { data } = await api.get('/admin/cj/sync-logs', { params })
  return data.data
}

export async function runCjSyncNow(body) {
  const { data } = await api.post('/admin/cj/sync-logs/run-now', body)
  return data
}
