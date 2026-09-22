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

  // Enough for a card to hint at options and bulk pricing without carrying the
  // whole variant list into a grid of sixty tiles. Defaulted so a response
  // served before these fields existed still parses.
  variantCount: z.number().int().default(0),
  // Cheapest variant at quantity 1. Null when there are no variants, and the
  // card falls back to salePrice/price.
  fromPrice: z.number().nullable().default(null),
  moq: z.number().int().default(1),
  hasBulkPricing: z.boolean().default(false),

  image: z.string().nullable(),
  // Responsive candidates for the card image. Null for uploads that predate
  // the derivative pipeline.
  imageSrcSet: z.string().nullable().default(null),
  isFlashsale: z.boolean(),
  isTrending: z.boolean(),
  rating: z.number(),
  reviewsCount: z.number(),
  // CJ-fulfilled product, shown as a small badge. Defaulted so a response
  // served before this field existed still parses.
  isDropship: z.boolean().default(false),
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

  // Tax. GST is inclusive in the listed price on this platform.
  hsnCode: z.string().default(''),
  gstRate: z.number().nullable().default(null),

  // B2B. moq of 1 means no minimum; priceTiers is empty unless the seller set
  // quantity breaks. Both defaulted so a product served before these fields
  // existed still parses.
  moq: z.number().int().default(1),
  priceTiers: z.array(z.object({ minQty: z.number().int(), price: z.number() })).default([]),

  // Buyable options. Non-empty means the product itself cannot be added to the
  // cart — one of these must be chosen (cartController enforces it).
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        attributes: z.record(z.string(), z.string()).default({}),
        // Null means "inherit the product's price".
        price: z.number().nullable(),
        salePrice: z.number().nullable(),
        stock: z.number().int(),
        image: z.string().nullable(),
      }),
    )
    .default([]),

  images: z.array(z.string()),
  imageSrcSets: z.array(z.string().nullable()).default([]),
  description: z.string(),
  isFlashsale: z.boolean(),
  isTrending: z.boolean(),
  rating: z.number(),
  reviewsCount: z.number(),
  isDropship: z.boolean().default(false),
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

// "Do you deliver to my PIN code?"
//
// `available: false` means we could not answer (shipping off, no warehouse,
// carrier unreachable) — which is NOT the same as "we do not deliver there".
// The screen has to say different things for the two, so they are different
// fields rather than one overloaded boolean.
export const deliveryCheckSchema = z.object({
  available: z.boolean(),
  pincode: z.string().optional(),
  reason: z.string().optional(),
  serviceable: z.boolean().optional(),
  prepaid: z.object({ available: z.boolean(), charge: z.number().nullable() }).optional(),
  cod: z.object({ available: z.boolean(), charge: z.number().nullable() }).optional(),
  estimatedDays: z.number().nullable().optional(),
  estimatedDeliveryDate: z.string().nullable().optional(),
})

// Storefront-wide catalog flags. Currently just the dropshipping visibility
// kill-switch (Admin > CJ Dropshipping > Settings), so the UI can hide any
// mention of it — filter option, badges — instead of showing a dead control.
export const catalogSettingsSchema = z.object({
  dropshippingEnabled: z.boolean().default(true),
})
