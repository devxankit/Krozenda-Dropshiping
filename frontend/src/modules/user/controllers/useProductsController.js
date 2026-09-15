// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchProducts, fetchProductById, fetchCategories, fetchBrands } from '../services/productService'

// ProductListingScreen / SearchFiltersScreen / ProductFiltersScreen: pull a
// demo-scale slice of the catalog and filter client-side (category/brand/
// price/rating) — matches the pattern those screens already used against
// hardcoded arrays, just backed by real data now.
export function useProductsController(params = {}) {
  const query = useQuery({ queryKey: ['catalog', 'products', params], queryFn: () => fetchProducts(params) })
  return { products: query.data || [], isLoading: query.isLoading }
}

// ProductDetailScreen.
export function useProductController(productId) {
  const query = useQuery({
    queryKey: ['catalog', 'product', productId],
    queryFn: () => fetchProductById(productId),
    enabled: Boolean(productId),
  })
  return { product: query.data, isLoading: query.isLoading, isError: query.isError }
}

export function useCategoriesController() {
  const query = useQuery({ queryKey: ['catalog', 'categories'], queryFn: fetchCategories })
  return { categories: query.data || [], isLoading: query.isLoading }
}

export function useBrandsController() {
  const query = useQuery({ queryKey: ['catalog', 'brands'], queryFn: fetchBrands })
  return { brands: query.data || [], isLoading: query.isLoading }
}
