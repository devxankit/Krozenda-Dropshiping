import { z } from 'zod'

const productRefSchema = z.object({ id: z.string(), name: z.string() }).nullable()

// ---------------------------------------------------------------------------
// Listing row — mirrors backend serializeProductCard().
//
// Deliberately a DIFFERENT (much smaller) shape from the detail product: the
// listing endpoint no longer sends `description` or the full `images` array,
// because a product grid never rendered either of them. Parsing a card with
// the full product schema would reject every row.
// ---------------------------------------------------------------------------
export const productCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().default(''),
  category: productRefSchema,
  brand: productRefSchema,
  price: z.number(),
  salePrice: z.number().nullable(),
  discountPercent: z.number(),
  stock: z.number(),
  image: z.string().nullable(),
  // Responsive candidates for the card image. Null for uploads that predate
  // the derivative pipeline.
  imageSrcSet: z.string().nullable().default(null),
  isFlashsale: z.boolean(),
  isTrending: z.boolean(),
  rating: z.number(),
  reviewsCount: z.number(),
})

export const productCardListSchema = z.array(productCardSchema)

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
})

export const productPageSchema = z.object({
  items: productCardListSchema,
  pagination: paginationSchema,
})

// ---------------------------------------------------------------------------
// Detail — mirrors backend serializePublicProduct().
// `vendor`, `approvalStatus` and `rejectionReason` are intentionally absent:
// the public endpoint no longer sends them (audit §57).
// ---------------------------------------------------------------------------
export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().default(''),
  category: productRefSchema,
  brand: z
    .object({ id: z.string(), name: z.string(), logo: z.string().nullable().default(null) })
    .nullable(),
  price: z.number(),
  salePrice: z.number().nullable(),
  discountPercent: z.number(),
  stock: z.number(),
  weight: z.number().nullable().default(null),
  images: z.array(z.string()),
  imageSrcSets: z.array(z.string().nullable()).default([]),
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
