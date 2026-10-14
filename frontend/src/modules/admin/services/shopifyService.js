import { api } from '../../../lib/axios'

// Admin > Dropshipping. The only layer allowed to touch axios.
//
// Shopify product ids are GIDs ("gid://shopify/Product/123"), which contain
// slashes — so any id going into a URL path is encoded, or the route stops
// matching halfway through the id.

// ---------------------------------------------------------------- connection

export async function fetchShopifySettings() {
  const { data } = await api.get('/admin/shopify/settings')
  return data.data
}

export async function connectShopify(payload) {
  const { data } = await api.post('/admin/shopify/settings/connect', payload)
  return data.data
}

export async function testShopifyConnection() {
  const { data } = await api.post('/admin/shopify/settings/test-connection')
  return data.data
}

export async function disconnectShopify() {
  const { data } = await api.post('/admin/shopify/settings/disconnect')
  return data.data
}

export async function setStorefrontVisibility(visible) {
  const { data } = await api.put('/admin/shopify/settings/visibility', { visible })
  return data.data
}

// ----------------------------------------------------------------- catalogue

// One page of the CONNECTED STORE's products — live from Shopify, not from
// Krozenda's database.
export async function fetchShopifyCatalogue({ cursor = null, limit = 25, search = '' } = {}, { signal } = {}) {
  const { data } = await api.get('/admin/shopify/catalogue', {
    params: { cursor: cursor || undefined, limit, search: search || undefined },
    signal,
  })
  return data.data
}

export async function fetchShopifyCatalogueCounts({ signal } = {}) {
  const { data } = await api.get('/admin/shopify/catalogue/count', { signal })
  return data.data
}

export async function fetchShopifyCatalogueProduct(shopifyProductId) {
  const { data } = await api.get(`/admin/shopify/catalogue/${encodeURIComponent(shopifyProductId)}`)
  return data.data
}

// items: [{ shopifyProductId, categoryId, brandId?, sellingPrice?, activate? }]
export async function importShopifyProducts(items) {
  const { data } = await api.post('/admin/shopify/catalogue/import', { items })
  return data.data
}

// ------------------------------------------------------------------ imported

export async function fetchImportedProducts({ page = 1, limit = 25 } = {}, { signal } = {}) {
  const { data } = await api.get('/admin/shopify/products', { params: { page, limit }, signal })
  return data.data
}

export async function updateImportedProduct(productId, payload) {
  const { data } = await api.patch(`/admin/shopify/products/${productId}`, payload)
  return data.data
}

export async function bulkUpdateImportedProducts(payload) {
  const { data } = await api.post('/admin/shopify/products/bulk', payload)
  return data.data
}

export async function removeImportedProduct(productId) {
  const { data } = await api.delete(`/admin/shopify/products/${productId}`)
  return data.data
}

// ------------------------------------------------------- fulfilment settings

export async function updateFulfilmentSettings(payload) {
  const { data } = await api.put('/admin/shopify/settings/fulfilment', payload)
  return data.data
}

// ------------------------------------------------------------------ webhooks

// Nothing subscribed means the integration is one-way: orders go out to
// Shopify and no fulfilment, tracking or stock change ever comes back.
export async function fetchWebhookHealth({ signal } = {}) {
  const { data } = await api.get('/admin/shopify/webhooks', { signal })
  return data.data
}

export async function registerWebhooks(baseUrl) {
  const { data } = await api.post('/admin/shopify/webhooks/register', baseUrl ? { baseUrl } : {})
  return data.data
}

export async function unregisterWebhooks() {
  const { data } = await api.delete('/admin/shopify/webhooks')
  return data.data
}

// --------------------------------------------------------------- order pushes

export async function fetchOrderPushes({ status = '', page = 1, limit = 25 } = {}, { signal } = {}) {
  const { data } = await api.get('/admin/shopify/order-pushes', {
    params: { status: status || undefined, page, limit },
    signal,
  })
  return data.data
}

export async function retryOrderPush(orderId) {
  const { data } = await api.post(`/admin/shopify/order-pushes/${orderId}/retry`)
  return data.data
}

export async function runOrderPushesNow() {
  const { data } = await api.post('/admin/shopify/order-pushes/run-now')
  return data.data
}

export async function syncImportedProducts() {
  const { data } = await api.post('/admin/shopify/products/sync')
  return data.data
}

// ------------------------------------------------------------------- money

// What each dropshipping platform was sent, and what Krozenda made on it.
export async function fetchSupplierEarnings({ start, end } = {}, { signal } = {}) {
  const { data } = await api.get('/admin/shopify/suppliers', {
    params: { start: start || undefined, end: end || undefined },
    signal,
  })
  return data.data
}

// Every state where money is somewhere it should not be.
export async function fetchPaymentExceptions({ signal } = {}) {
  const { data } = await api.get('/admin/shopify/payment-exceptions', { signal })
  return data.data
}
