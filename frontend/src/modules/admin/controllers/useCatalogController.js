// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as service from '../services/catalogService'
import { useAdminMutation } from './useAdminMutation'
import { fetchApprovalQueue, fetchBrands, fetchCategoryTree, fetchInventory } from '../services/catalogService'
import { useListController } from './useListController'

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

// Server-paged admin product list. Keyed under ['admin', 'catalog'] so every
// product write refreshes it; the previous page stays on screen while the
// next one loads, so paging and typing in search don't flash a skeleton.
export function useProductPageController(params) {
  const query = useQuery({
    queryKey: ['admin', 'catalog', 'products', 'page', params],
    queryFn: ({ signal }) => service.fetchProductPage(params, { signal }),
    placeholderData: keepPreviousData,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
// Keyed under ['admin', 'catalog'] so every product write (which invalidates
// that whole subtree) refreshes the detail screen along with the list.
export function useProductDetailController(productId) {
  const query = useQuery({
    queryKey: ['admin', 'catalog', 'product', productId],
    queryFn: () => service.fetchProduct(productId),
    enabled: Boolean(productId),
  })
  return { product: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useApprovalQueueController = () => useCatalogResource('approvals', fetchApprovalQueue)
// `enabled` lets the always-mounted sidebar skip the call for staff who lack
// the approve permission (the endpoint would just answer 403).
export function useApprovalSettingsController({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['admin', 'catalog', 'approval-settings'],
    queryFn: service.fetchApprovalSettings,
    enabled,
  })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
export const useCategoryTreeController = () => useCatalogResource('categories', fetchCategoryTree)
export const useBrandsController = () => useCatalogResource('brands', fetchBrands)
// Catalog writes touch listings, the approval queue and the category tree at
// once — approving a category unblocks the products waiting on it — so they
// all invalidate the catalog subtree rather than one list.
const CATALOG = [['admin', 'catalog']]

export const useProductWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createProduct,
    invalidate: CATALOG,
    success: (product) => `${product.name} created`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateProduct,
    invalidate: CATALOG,
    success: (product) => `${product.name} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateProductStatus,
    invalidate: CATALOG,
    success: (product) => `${product.name} ${product.isActive ? 'activated' : 'deactivated'}`,
  }),
  setFlashSaleStatus: useAdminMutation({
    mutationFn: service.updateProductFlashSaleStatus,
    invalidate: CATALOG,
    success: (product) =>
      `${product.name} ${product.isFlashsale ? 'marked for Flash Sale 🔥' : 'removed from Flash Sale'}`,
  }),
  setTrendingStatus: useAdminMutation({
    mutationFn: service.updateProductTrendingStatus,
    invalidate: CATALOG,
    success: (product) =>
      `${product.name} ${product.isTrending ? 'marked as Trending 📈' : 'removed from Trending'}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteProduct,
    invalidate: CATALOG,
    success: 'Product removed',
  }),
})

export const useApprovalSettingsWriteController = () => ({
  update: useAdminMutation({
    mutationFn: service.updateApprovalSettings,
    invalidate: CATALOG,
    success: (data, variables) => {
      if (variables.sellerOnlyMode !== undefined) {
        return variables.sellerOnlyMode
          ? 'Own stock turned off — admin products are hidden from buyers and admin can no longer add products, categories or brands'
          : 'Own stock turned on — admin products are back on the storefront'
      }
      if (!data.autoApprovalEnabled) return 'Auto-approval turned off'
      const rate = variables.commission
      return rate
        ? `Auto-approval turned on — common commission ${rate.type === 'FIXED' ? `₹${rate.value} / unit` : `${rate.value}%`}`
        : 'Auto-approval turned on'
    },
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
    success: (node) => `${node.name} ${node.isActive ? 'activated' : 'deactivated'}`,
  }),
  setTopStatus: useAdminMutation({
    mutationFn: service.updateCategoryTopStatus,
    invalidate: CATALOG,
    success: (node) =>
      `${node.name} ${node.isTopCategory ? 'marked as top category' : 'removed from top categories'}`,
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
    success: (brand) => `${brand.name} ${brand.isActive ? 'activated' : 'deactivated'}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteBrand,
    invalidate: CATALOG,
    success: 'Brand removed',
    onDone: onSaved,
  }),
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
