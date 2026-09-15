// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { productSchema, productListSchema, categoryListSchema, brandListSchema } from '../schemas/productSchema'

export async function fetchProducts(params = {}) {
  const response = await api.get('/catalog/products', { params })
  return productListSchema.parse(response.data.data.items)
}

export async function fetchProductById(id) {
  const response = await api.get(`/catalog/products/${id}`)
  return productSchema.parse(response.data.data)
}

export async function fetchCategories() {
  const response = await api.get('/catalog/categories')
  return categoryListSchema.parse(response.data.data.items)
}

export async function fetchBrands() {
  const response = await api.get('/catalog/brands')
  return brandListSchema.parse(response.data.data.items)
}
