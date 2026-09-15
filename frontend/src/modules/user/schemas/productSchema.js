import { z } from 'zod'

// Mirrors backend/Controllers/productController.js's serializeProduct().
const productRefSchema = z
  .object({ id: z.string(), name: z.string() })
  .nullable()

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  category: productRefSchema,
  brand: productRefSchema,
  price: z.number(),
  salePrice: z.number().nullable(),
  discountPercent: z.number(),
  stock: z.number(),
  images: z.array(z.string()),
  description: z.string(),
  isFlashsale: z.boolean(),
  isTrending: z.boolean(),
  rating: z.number(),
  reviewsCount: z.number(),
})

export const productListSchema = z.array(productSchema)

// Mirrors backend/Controllers/categoryController.js's listPublicCategories().
export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  isTopCategory: z.boolean(),
  productCount: z.number(),
  maxDiscountPercent: z.number(),
})

export const categoryListSchema = z.array(categorySchema)

// Mirrors backend/Controllers/brandController.js's serializeBrand().
export const brandSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
})

export const brandListSchema = z.array(brandSchema)
