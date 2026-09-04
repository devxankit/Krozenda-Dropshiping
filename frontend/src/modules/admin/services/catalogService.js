// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/catalog'
const {
  approvalQueueFixture,
  attributeListFixture,
  brandListFixture,
  categoryTreeFixture,
  importRunFixture,
  inventoryFixture,
  productDetailFixture,
  productListFixture,
  supplierSyncFixture,
} = fixtures
import {
  approvalQueueSchema,
  attributeListSchema,
  brandListSchema,
  categoryTreeSchema,
  importRunSchema,
  inventorySchema,
  productDetailSchema,
  productListSchema,
  supplierSyncSchema,
  attributeSchema,
  categoryNodeSchema,
  deletedSchema,
  inventoryRowSchema,
  productSchema,
  queueDecisionSchema,
} from '../schemas/catalogSchema'

export function fetchProducts(query) {
  return fetchResource({
    path: '/admin/catalog/products',
    params: { tab: query.tab, page: query.page, rowsPerPage: query.rowsPerPage, ...query.filters },
    fixture: () => productListFixture(query),
    schema: productListSchema,
  })
}

export function fetchProductDetail(productId) {
  return fetchResource({
    path: `/admin/catalog/products/${productId}`,
    fixture: () => productDetailFixture(productId),
    schema: productDetailSchema,
  })
}

export function fetchApprovalQueue(query = {}) {
  return fetchResource({
    path: '/admin/catalog/approvals',
    params: { tab: query.tab },
    fixture: approvalQueueFixture,
    schema: approvalQueueSchema,
  })
}

export function fetchCategoryTree() {
  return fetchResource({
    path: '/admin/catalog/categories',
    fixture: categoryTreeFixture,
    schema: categoryTreeSchema,
  })
}

export function fetchBrands() {
  return fetchResource({
    path: '/admin/catalog/brands',
    fixture: brandListFixture,
    schema: brandListSchema,
  })
}

export function fetchAttributes() {
  return fetchResource({
    path: '/admin/catalog/attributes',
    fixture: attributeListFixture,
    schema: attributeListSchema,
  })
}

export function fetchInventory(query = {}) {
  return fetchResource({
    path: '/admin/catalog/inventory',
    params: { tab: query.tab, ...query.filters },
    fixture: () => inventoryFixture(query),
    schema: inventorySchema,
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

export const createProduct = (body) =>
  mutateResource({ path: '/admin/catalog/products', body, fixture: fixtures.createProductFixture, schema: productSchema })

export const updateProduct = ({ id, ...body }) =>
  mutateResource({ method: 'put', path: `/admin/catalog/products/${id}`, body, fixture: (p) => fixtures.updateProductFixture(id, p), schema: productSchema })

export const setProductStatus = ({ id, status }) =>
  mutateResource({ method: 'put', path: `/admin/catalog/products/${id}/status`, body: { status }, fixture: () => fixtures.setProductStatusFixture(id, status), schema: productSchema })

export const deleteProduct = ({ id }) =>
  mutateResource({ method: 'delete', path: `/admin/catalog/products/${id}`, fixture: () => fixtures.deleteProductFixture(id), schema: deletedSchema })

export const approveQueueItem = ({ id }) =>
  mutateResource({ path: `/admin/catalog/approvals/${id}/approve`, body: { id }, fixture: () => fixtures.approveQueueItemFixture(id), schema: queueDecisionSchema })

export const rejectQueueItem = ({ id, reason }) =>
  mutateResource({ path: `/admin/catalog/approvals/${id}/reject`, body: { reason }, fixture: (p) => fixtures.rejectQueueItemFixture(id, p), schema: queueDecisionSchema })

export const createCategory = (body) =>
  mutateResource({ path: '/admin/catalog/categories', body, fixture: fixtures.createCategoryFixture, schema: categoryNodeSchema })

export const updateCategory = ({ id, ...body }) =>
  mutateResource({ method: 'put', path: `/admin/catalog/categories/${id}`, body, fixture: (p) => fixtures.updateCategoryFixture(id, p), schema: categoryNodeSchema })

export const deleteCategory = ({ id }) =>
  mutateResource({ method: 'delete', path: `/admin/catalog/categories/${id}`, fixture: () => fixtures.deleteCategoryFixture(id), schema: deletedSchema })

export const createAttribute = (body) =>
  mutateResource({ path: '/admin/catalog/attributes', body, fixture: fixtures.createAttributeFixture, schema: attributeSchema })

export const updateAttribute = ({ id, ...body }) =>
  mutateResource({ method: 'put', path: `/admin/catalog/attributes/${id}`, body, fixture: (p) => fixtures.updateAttributeFixture(id, p), schema: attributeSchema })

export const deleteAttribute = ({ id }) =>
  mutateResource({ method: 'delete', path: `/admin/catalog/attributes/${id}`, fixture: () => fixtures.deleteAttributeFixture(id), schema: deletedSchema })

export const adjustInventory = ({ id, onHand, reason }) =>
  mutateResource({ path: `/admin/catalog/inventory/${id}/adjust`, body: { onHand, reason }, fixture: (p) => fixtures.adjustInventoryFixture(id, p), schema: inventoryRowSchema })
