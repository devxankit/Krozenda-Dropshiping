// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/catalogService'
import { useAdminMutation } from './useAdminMutation'
import {
  fetchApprovalQueue,
  fetchAttributes,
  fetchBrands,
  fetchCategoryTree,
  fetchImportRun,
  fetchInventory,
  fetchProductDetail,
  fetchProducts,
  fetchSupplierSync,
} from '../services/catalogService'
import { useListController } from './useListController'

export function useProductListController() {
  return useListController({
    queryKey: ['admin', 'catalog', 'products'],
    queryFn: fetchProducts,
    defaultSort: { key: 'updatedAt', direction: 'desc' },
  })
}

export function useProductDetailController(productId) {
  const query = useQuery({
    queryKey: ['admin', 'catalog', 'products', productId],
    queryFn: () => fetchProductDetail(productId),
    enabled: Boolean(productId),
  })
  return { product: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useInventoryController() {
  return useListController({
    queryKey: ['admin', 'catalog', 'inventory'],
    queryFn: fetchInventory,
  })
}

// The read-only catalog screens share one shape, so they share one hook.
function useCatalogResource(key, queryFn) {
  const query = useQuery({ queryKey: ['admin', 'catalog', key], queryFn })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useApprovalQueueController = () => useCatalogResource('approvals', fetchApprovalQueue)
export const useCategoryTreeController = () => useCatalogResource('categories', fetchCategoryTree)
export const useBrandsController = () => useCatalogResource('brands', fetchBrands)
export const useAttributesController = () => useCatalogResource('attributes', fetchAttributes)
export const useImportRunController = () => useCatalogResource('import', fetchImportRun)
export const useSupplierSyncController = () => useCatalogResource('supplier-sync', fetchSupplierSync)

// Catalog writes touch listings, the approval queue and the category tree at
// once — approving a category unblocks the products waiting on it — so they
// all invalidate the catalog subtree rather than one list.
const CATALOG = [['admin', 'catalog']]

export const useProductWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createProduct,
    invalidate: CATALOG,
    success: (product) => `${product.name} created`,
    describe: (product) => (product.status === 'draft' ? 'Saved as a draft.' : 'Submitted for approval.'),
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateProduct,
    invalidate: CATALOG,
    success: (product) => `${product.name} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.setProductStatus,
    invalidate: CATALOG,
    success: (product) => `${product.name} is now ${product.status}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteProduct,
    invalidate: CATALOG,
    success: 'Listing removed',
  }),
})

export const useApprovalWriteController = ({ onDone } = {}) => ({
  approve: useAdminMutation({
    mutationFn: service.approveQueueItem,
    invalidate: CATALOG,
    success: (item) => `${item.name} approved`,
    describe: (item) => (item.kind === 'category' ? 'Anything waiting on this category is now unblocked.' : undefined),
  }),
  reject: useAdminMutation({
    mutationFn: service.rejectQueueItem,
    invalidate: CATALOG,
    success: (item) => `${item.name} rejected`,
    onDone,
  }),
})

export const useCategoryWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createCategory,
    invalidate: CATALOG,
    success: (node) => `${node.name} added`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateCategory,
    invalidate: CATALOG,
    success: (node) => `${node.name} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateCategoryStatus,
    invalidate: CATALOG,
    success: (node) => `${node.name} status updated`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteCategory,
    invalidate: CATALOG,
    success: 'Category removed',
    onDone: onSaved,
  }),
})

export const useBrandWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createBrand,
    invalidate: CATALOG,
    success: (brand) => `${brand.name} created`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateBrand,
    invalidate: CATALOG,
    success: (brand) => `${brand.name} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateBrandStatus,
    invalidate: CATALOG,
    success: (brand) => `${brand.name} status updated`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteBrand,
    invalidate: CATALOG,
    success: 'Brand removed',
    onDone: onSaved,
  }),
})

export const useAttributeWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createAttribute,
    invalidate: CATALOG,
    success: (attribute) => `${attribute.name} added`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateAttribute,
    invalidate: CATALOG,
    success: (attribute) => `${attribute.name} updated`,
    onDone: onSaved,
  }),
  remove: useAdminMutation({ mutationFn: service.deleteAttribute, invalidate: CATALOG, success: 'Attribute removed' }),
})

export const useInventoryWriteController = ({ onSaved } = {}) => ({
  adjust: useAdminMutation({
    mutationFn: service.adjustInventory,
    invalidate: CATALOG,
    success: (row) => `${row.sku} set to ${row.onHand} on hand`,
    describe: (row) => `${row.available} available after ${row.reserved} reserved`,
    onDone: onSaved,
  }),
})
