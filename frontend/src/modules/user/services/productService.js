// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import {
  productSchema,
  productPageSchema,
  productCardListSchema,
  categoryListSchema,
  brandListSchema,
} from '../schemas/productSchema'

// `signal` is threaded through to axios so a superseded search (or a screen
// the user navigated away from) actually aborts its request instead of
// finishing and overwriting fresher results — the "old `iph` response
// clobbers the newer `iphone` one" problem in the audit (§27, §33).
export async function fetchProducts(params = {}, { signal } = {}) {
  const response = await api.get('/catalog/products', { params, signal })
  return productPageSchema.parse({
    items: response.data.data.items,
    pagination: response.data.pagination,
  })
}

export async function fetchProductById(id, { signal } = {}) {
  const response = await api.get(`/catalog/products/${id}`, { signal })
  return productSchema.parse(response.data.data)
}

// Loaded separately from the product itself so the detail page can paint
// price / stock / Add to Cart first and fill this rail in afterwards.
export async function fetchRelatedProducts(id, { signal } = {}) {
  const response = await api.get(`/catalog/products/${id}/related`, { signal })
  return productCardListSchema.parse(response.data.data.items)
}

export async function fetchCategories({ signal } = {}) {
  const response = await api.get('/catalog/categories', { signal })
  return categoryListSchema.parse(response.data.data.items)
}

export async function fetchBrands({ signal } = {}) {
  const response = await api.get('/catalog/brands', { signal })
  return brandListSchema.parse(response.data.data.items)
}
