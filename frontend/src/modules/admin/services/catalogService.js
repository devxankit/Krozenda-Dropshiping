import { api } from '../../../lib/axios'
import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/catalog'
const {
  approvalQueueFixture,
  attributeListFixture,
  importRunFixture,
  inventoryFixture,
  supplierSyncFixture,
} = fixtures
import {
  approvalQueueSchema,
  attributeListSchema,
  importRunSchema,
  inventorySchema,
  supplierSyncSchema,
  attributeSchema,
  deletedSchema,
  inventoryRowSchema,
  queueDecisionSchema,
} from '../schemas/catalogSchema'

export async function fetchProducts() {
  const { data } = await api.get('/admin/catalog/products')
  return data.data
}

export async function fetchProduct(id) {
  const { data } = await api.get(`/admin/catalog/products/${id}`)
  return data.data
}

export function fetchApprovalQueue(query = {}) {
  return fetchResource({
    path: '/admin/catalog/approvals',
    params: { tab: query.tab },
    fixture: approvalQueueFixture,
    schema: approvalQueueSchema,
    live: true,
  })
}

export async function fetchApprovalSettings() {
  const { data } = await api.get('/admin/catalog/approvals/settings')
  return data.data
}

export async function updateApprovalSettings({ autoApprovalEnabled, sellerOnlyMode }) {
  const { data } = await api.put('/admin/catalog/approvals/settings', { autoApprovalEnabled, sellerOnlyMode })
  return data.data
}

export async function fetchCategoryTree() {
  const { data } = await api.get('/admin/catalog/categories')
  return data.data
}

export async function fetchBrands() {
  const { data } = await api.get('/admin/catalog/brands')
  return data.data
}

export function fetchAttributes() {
  return fetchResource({
    path: '/admin/catalog/attributes',
    fixture: attributeListFixture,
    schema: attributeListSchema,
    live: true,
  })
}

export function fetchInventory(query = {}) {
  return fetchResource({
    path: '/admin/catalog/inventory',
    params: {
      tab: query.tab,
      page: query.page,
      rowsPerPage: query.rowsPerPage,
      sort: query.sort ? `${query.sort.key}:${query.sort.direction}` : undefined,
      ...query.filters,
    },
    fixture: () => inventoryFixture(query),
    schema: inventorySchema,
    live: true,
  })
}

export function fetchImportRun() {
  return fetchResource({
    path: '/admin/catalog/import/latest',
    fixture: importRunFixture,
    schema: importRunSchema,
  })
}

export function fetchSupplierSync() {
  return fetchResource({
    path: '/admin/catalog/supplier-sync',
    fixture: supplierSyncFixture,
    schema: supplierSyncSchema,
  })
}

// --- writes ---------------------------------------------------------------

// Products carry a gallery (multiple files under one field) and an optional
// removeImages list, which the generic toFormData below cannot express — it
// appends one value per key. This builds the multipart body by hand instead.
//
// Unlike toFormData, this only drops `undefined` (field not part of the
// request). `null` is sent as an empty string rather than skipped, because
// the product form always resends its full state — an empty sale price,
// weight or brand is the user clearing that field, and the backend reads an
// empty string on those keys as "clear it" rather than "leave it alone".
// Fields the product endpoints expect as JSON inside a multipart body.
const JSON_FIELDS = new Set(['dimensions', 'priceTiers', 'variants'])

function buildProductFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return
    if (key === 'images' && Array.isArray(value)) {
      value.forEach((file) => formData.append('images', file))
      return
    }
    if (key === 'removeImages' && Array.isArray(value)) {
      if (value.length) formData.append('removeImages', JSON.stringify(value))
      return
    }
    // Structured fields have to travel JSON-encoded: multipart has no notion
    // of an array or an object, and the generic append below would stringify
    // them to "[object Object]" and comma-joined noise. The server parses
    // these back with parseJsonField.
    if (JSON_FIELDS.has(key)) {
      // null is meaningful for `dimensions` ("cleared"), so it is sent rather
      // than skipped — skipping would leave the old value in place.
      formData.append(key, JSON.stringify(value ?? null))
      return
    }
    formData.append(key, value === null ? '' : value)
  })
  return formData
}

export async function createProduct(payload) {
  const { data } = await api.post('/admin/catalog/products', buildProductFormData(payload))
  return data.data
}

export async function updateProduct({ id, ...payload }) {
  const { data } = await api.put(`/admin/catalog/products/${id}`, buildProductFormData(payload))
  return data.data
}

export async function updateProductStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/catalog/products/${id}/status`, { isActive })
  return data.data
}

export async function updateProductFlashSaleStatus({ id, isFlashsale }) {
  const { data } = await api.patch(`/admin/catalog/products/${id}/flash-sale`, { isFlashsale })
  return data.data
}

export async function updateProductTrendingStatus({ id, isTrending }) {
  const { data } = await api.patch(`/admin/catalog/products/${id}/trending`, { isTrending })
  return data.data
}

export async function deleteProduct({ id }) {
  const { data } = await api.delete(`/admin/catalog/products/${id}`)
  return data.data
}

export const approveQueueItem = ({ id }) =>
  mutateResource({ path: `/admin/catalog/approvals/${id}/approve`, body: { id }, fixture: () => fixtures.approveQueueItemFixture(id), schema: queueDecisionSchema, live: true })

export const rejectQueueItem = ({ id, reason }) =>
  mutateResource({ path: `/admin/catalog/approvals/${id}/reject`, body: { reason }, fixture: (p) => fixtures.rejectQueueItemFixture(id, p), schema: queueDecisionSchema, live: true })

function toFormData(payload) {
  if (payload instanceof FormData) return payload
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, value)
  })
  return formData
}

export async function createCategory(payload) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.post('/admin/catalog/categories', body)
  return data.data
}

export async function updateCategory({ id, ...payload }) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.put(`/admin/catalog/categories/${id}`, body)
  return data.data
}

export async function updateCategoryStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/catalog/categories/${id}/status`, { isActive })
  return data.data
}

export async function updateCategoryTopStatus({ id, isTopCategory }) {
  const { data } = await api.patch(`/admin/catalog/categories/${id}/top`, { isTopCategory })
  return data.data
}

export async function deleteCategory({ id }) {
  const { data } = await api.delete(`/admin/catalog/categories/${id}`)
  return data.data
}

export async function createBrand(payload) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.post('/admin/catalog/brands', body)
  return data.data
}

export async function updateBrand({ id, ...payload }) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.put(`/admin/catalog/brands/${id}`, body)
  return data.data
}

export async function updateBrandStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/catalog/brands/${id}/status`, { isActive })
  return data.data
}

export async function deleteBrand({ id }) {
  const { data } = await api.delete(`/admin/catalog/brands/${id}`)
  return data.data
}

export const createAttribute = (body) =>
  mutateResource({ path: '/admin/catalog/attributes', body, fixture: fixtures.createAttributeFixture, schema: attributeSchema, live: true })

export const updateAttribute = ({ id, ...body }) =>
  mutateResource({ method: 'put', path: `/admin/catalog/attributes/${id}`, body, fixture: (p) => fixtures.updateAttributeFixture(id, p), schema: attributeSchema, live: true })

export const deleteAttribute = ({ id }) =>
  mutateResource({ method: 'delete', path: `/admin/catalog/attributes/${id}`, fixture: () => fixtures.deleteAttributeFixture(id), schema: deletedSchema, live: true })

export const adjustInventory = ({ id, onHand, reason }) =>
  mutateResource({
    method: 'patch',
    path: `/admin/catalog/inventory/${id}/adjust`,
    body: { onHand, reason },
    fixture: (p) => fixtures.adjustInventoryFixture(id, p),
    schema: inventoryRowSchema,
    live: true,
  })
