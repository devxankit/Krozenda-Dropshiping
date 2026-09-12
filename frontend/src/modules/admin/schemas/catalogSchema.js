import { z } from 'zod'

// Runtime contract for the catalog endpoints.

// The real product entity — a single-tenant catalog item with a category,
// brand, price/discount and an image gallery. Unlike the schemas below it, it
// talks to the real backend rather than a fixture.
export const productNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  category: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  brand: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  price: z.number(),
  salePrice: z.number().nullable().optional(),
  discountPercent: z.number().optional(),
  stock: z.number(),
  weight: z.number().nullable().optional(),
  images: z.array(z.string()).optional(),
  description: z.string().optional(),
  isActive: z.boolean(),
  isFlashsale: z.boolean().optional(),
  isFlashSale: z.boolean().optional(),
  isTrending: z.boolean().optional(),
}).passthrough()

export const productListSchema = z.object({
  items: z.array(productNodeSchema),
  stats: z.record(z.string(), z.any()).optional(),
}).passthrough()

export const approvalQueueSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['category', 'brand', 'product']),
      name: z.string(),
      context: z.string(),
      submittedBy: z.string(),
      submittedAt: z.string(),
      waitingDays: z.number().int(),
      blockedBy: z.string().nullable(),
    }),
  ),
  tabCounts: z.record(z.string(), z.number()),
})

export const categoryTreeSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      image: z.string().nullable().optional(),
      isActive: z.boolean(),
      isTopCategory: z.boolean().optional(),
    }).passthrough(),
  ),
  stats: z.record(z.string(), z.any()).optional(),
}).passthrough()

export const brandListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      logo: z.string().nullable().optional(),
      isActive: z.boolean(),
    }).passthrough(),
  ),
  stats: z.record(z.string(), z.any()).optional(),
}).passthrough()

export const inventorySchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sku: z.string(),
      bucket: z.enum(['own_stock', 'vendor']),
      owner: z.string(),
      onHand: z.number().int(),
      reserved: z.number().int(),
      available: z.number().int(),
      daysCover: z.number().int().nullable(),
    }),
  ),
  tabCounts: z.record(z.string(), z.number()),
})

export const importRunSchema = z.object({
  fileName: z.string(),
  uploadedAt: z.string(),
  totalRows: z.number().int(),
  validRows: z.number().int(),
  errorRows: z.number().int(),
  mapping: z.array(
    z.object({ column: z.string(), field: z.string().nullable(), sample: z.string() }),
  ),
  errors: z.array(
    z.object({ row: z.number().int(), column: z.string(), value: z.string(), message: z.string() }),
  ),
})

export const supplierSyncSchema = z.object({
  adapters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.enum(['operational', 'degraded', 'down', 'not_configured']),
      lastRunAt: z.string().nullable(),
      productsTracked: z.number().int(),
      syncs: z.array(z.string()),
    }),
  ),
  runs: z.array(
    z.object({
      id: z.string(),
      adapter: z.string(),
      startedAt: z.string(),
      durationSeconds: z.number(),
      updated: z.number().int(),
      failed: z.number().int(),
      status: z.enum(['success', 'partial', 'failed']),
    }),
  ),
})

export const attributeListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['select', 'multiselect', 'text', 'number']),
      values: z.array(z.string()),
      usedBy: z.number().int(),
    }),
  ),
})

// ---------------------------------------------------------------------------
// Write contracts
// ---------------------------------------------------------------------------

export const productSchema = productNodeSchema

export const categoryNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  isActive: z.boolean(),
  isTopCategory: z.boolean().optional(),
}).passthrough()

export const brandNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable().optional(),
  isActive: z.boolean(),
}).passthrough()

export const attributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['select', 'multiselect', 'text', 'number']),
  values: z.array(z.string()),
  usedBy: z.number().int(),
})

export const inventoryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  bucket: z.enum(['own_stock', 'vendor']),
  owner: z.string(),
  onHand: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
  daysCover: z.number().int().nullable(),
})

export const queueDecisionSchema = z.object({
  id: z.string(),
  kind: z.enum(['product', 'brand', 'category']),
  name: z.string(),
})

export const deletedSchema = z.object({ id: z.string() })

export const productWriteSchema = z
  .object({
    name: z.string().min(2, 'Give the product a name'),
    sku: z.string().optional(),
    category: z.string().min(1, 'Pick a category'),
    brand: z.string().optional(),
    price: z.number().positive('Enter a price above zero'),
    salePrice: z.number().min(0).nullable().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0, 'Stock cannot be negative'),
    weight: z.number().min(0).nullable().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    isFlashsale: z.boolean().optional(),
    isFlashSale: z.boolean().optional(),
    isTrending: z.boolean().optional(),
  })
  .refine((data) => data.salePrice == null || data.salePrice <= data.price, {
    message: 'Sale price cannot be higher than the regular price',
    path: ['salePrice'],
  })

export const categoryWriteSchema = z.object({
  name: z.string().min(2, 'Give the category a name'),
  isActive: z.boolean().optional(),
  isTopCategory: z.boolean().optional(),
})

export const brandWriteSchema = z.object({
  name: z.string().min(2, 'Give the brand a name'),
  isActive: z.boolean().optional(),
})

export const attributeWriteSchema = z.object({
  name: z.string().min(2, 'Give the attribute a name'),
  type: z.enum(['select', 'multiselect', 'text', 'number']),
  values: z.array(z.string().min(1)).min(1, 'Add at least one value'),
})

export const inventoryAdjustSchema = z.object({
  onHand: z.number().int().min(0, 'On-hand cannot be negative'),
  reason: z.string().min(3, 'Say why the count changed'),
})
