// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchProducts,
  fetchProductById,
  fetchRelatedProducts,
  fetchCategories,
  fetchBrands,
  fetchCatalogSettings,
} from '../services/productService'

// Server-side paging, filtering and sorting.
//
// This used to pull `limit: 100` once and filter the whole catalog in the
// browser, which meant: a hard 100-product ceiling on what was reachable, a
// large payload on every visit regardless of what was shown, and filters that
// only ever narrowed that arbitrary slice rather than the catalog.
//
// `keepPreviousData` is what stops the grid blanking to a skeleton on every
// page/filter change — the previous page stays on screen, dimmed, until the
// new one arrives (no flicker, no layout jump).
export function useProductsController(params = {}, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ['catalog', 'products', params],
    queryFn: ({ signal }) => fetchProducts(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })

  return {
    products: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    // Distinct from isLoading: a background refetch for the next page should
    // dim the grid, not replace it with a skeleton.
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// ProductDetailScreen.
export function useProductController(productId) {
  const query = useQuery({
    queryKey: ['catalog', 'product', productId],
    queryFn: ({ signal }) => fetchProductById(productId, { signal }),
    enabled: Boolean(productId),
  })
  return {
    product: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// Secondary content on the detail page — mounted below the fold and allowed
// to fail without taking the product with it.
export function useRelatedProductsController(productId) {
  const query = useQuery({
    queryKey: ['catalog', 'product', productId, 'related'],
    queryFn: ({ signal }) => fetchRelatedProducts(productId, { signal }),
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
  })
  return { products: query.data ?? [], isLoading: query.isLoading }
}

// Categories and brands change rarely and are read by the header, the home
// page, the category page and every filter panel. A long staleTime is what
// collapses those into one request per session instead of one per screen
// (audit §32, duplicate API calls).
export function useCategoriesController() {
  const query = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: ({ signal }) => fetchCategories({ signal }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
  return { categories: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useBrandsController() {
  const query = useQuery({
    queryKey: ['catalog', 'brands'],
    queryFn: ({ signal }) => fetchBrands({ signal }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
  return { brands: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

// Whether dropshipping products are visible to customers at all (Admin > CJ
// Dropshipping > Settings). Defaults to `true` while loading/on error so the
// filter doesn't flash in and out — it only ever needs to hide something, and
// briefly showing it during the first load is harmless since the server-side
// filter (productController) already enforces the real restriction.
export function useCatalogSettingsController() {
  const query = useQuery({
    queryKey: ['catalog', 'settings'],
    queryFn: ({ signal }) => fetchCatalogSettings({ signal }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
  return {
    dropshippingEnabled: query.data?.dropshippingEnabled ?? true,
    isLoading: query.isLoading,
  }
}
