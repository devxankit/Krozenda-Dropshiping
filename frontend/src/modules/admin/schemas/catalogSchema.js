import { z } from 'zod'
import { BUSINESS_MODEL } from '../../../config/constants'
import { PRODUCT_TYPE, REVIEW_STATUS } from '../constants'

// Runtime contract for the catalog endpoints. Money is in PAISE.

const businessModel = z.enum([
  BUSINESS_MODEL.MARKETPLACE,
  BUSINESS_MODEL.DROPSHIPPING,
  BUSINESS_MODEL.OWN_STOCK,
])

const reviewStatus = z.enum(Object.values(REVIEW_STATUS))
const productType = z.enum(Object.values(PRODUCT_TYPE))

export const productListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  type: productType,
  model: businessModel,
  seller: z.string(),
  category: z.string(),
  brand: z.string(),
  price: z.number().int(),
  stock: z.number().int(),
  status: reviewStatus,
  updatedAt: z.string(),
})

export const productListSchema = z.object({
  items: z.array(productListItemSchema),
  page: z.number().int().positive(),
  rowsPerPage: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  tabCounts: z.record(z.string(), z.number()),
})

export const priceTierSchema = z.object({
  role: z.string(),
  label: z.string(),
  mrp: z.number().int(),
  price: z.number().int(),
  minQty: z.number().int().positive(),
  margin: z.number(),
})

export const productDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  barcode: z.string().nullable(),
  type: productType,
  model: businessModel,
  status: reviewStatus,
  seller: z.object({ id: z.string(), name: z.string() }),
  category: z.string(),
  brand: z.object({ name: z.string(), status: reviewStatus }),
  description: z.string(),
  tax: z.object({ hsn: z.string(), gstRate: z.number(), countryOfOrigin: z.string() }),
  moq: z.number().int().positive(),
  priceTiers: z.array(priceTierSchema),
  // The resolution chain from project context §6.5, most specific first.
  commission: z.object({
    resolvedFrom: z.enum(['product', 'vendor', 'category', 'company', 'default']),
    type: z.enum(['percentage', 'fixed']),
    value: z.number(),
    chain: z.array(
      z.object({
        scope: z.enum(['product', 'vendor', 'category', 'company', 'default']),
        label: z.string(),
        value: z.number().nullable(),
        applies: z.boolean(),
      }),
    ),
  }),
  inventory: z.array(
    z.object({
      bucket: z.string(),
      location: z.string(),
      onHand: z.number().int(),
      reserved: z.number().int(),
      available: z.number().int(),
    }),
  ),
  approvalHistory: z.array(
    z.object({
      label: z.string(),
      at: z.string().nullable(),
      actor: z.string().nullable(),
      reason: z.string().nullable(),
      done: z.boolean(),
      tone: z.enum(['default', 'success', 'warning', 'danger']).optional(),
    }),
  ),
  issues: z.array(z.object({ field: z.string(), message: z.string() })),
})

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
  nodes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      depth: z.number().int().nonnegative(),
      productCount: z.number().int(),
      commissionRate: z.number().nullable(),
      status: z.string(),
      slug: z.string().optional(),
      image: z.string().nullable().optional(),
      parent: z.string().nullable().optional(),
      parentId: z.string().nullable().optional(),
      parentName: z.string().nullable().optional(),
      description: z.string().optional(),
    }).passthrough(),
  ),
  stats: z.record(z.string(), z.any()).optional(),
}).passthrough()

export const brandListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      owner: z.string(),
      productCount: z.number().int(),
      status: z.string(),
      submittedAt: z.string().optional(),
      slug: z.string().optional(),
      logo: z.string().nullable().optional(),
      website: z.string().optional(),
      description: z.string().optional(),
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

export const productSchema = productListItemSchema

export const categoryNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  depth: z.number().int().nonnegative(),
  productCount: z.number().int(),
  commissionRate: z.number().nullable(),
  status: z.string(),
}).passthrough()

export const brandNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  productCount: z.number().int(),
  status: z.string(),
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

export const productWriteSchema = z.object({
  name: z.string().min(3, 'Give the product a name'),
  sku: z.string().min(3, 'Every product needs a SKU'),
  category: z.string().min(1, 'Pick a category'),
  brand: z.string().min(1, 'Pick a brand'),
  price: z.number().int().positive('Enter a price above zero'),
  stock: z.number().int().min(0),
  model: z.string().min(1),
  type: z.string().min(1),
  status: z.enum(['draft', 'submitted']),
})

export const categoryWriteSchema = z.object({
  name: z.string().min(2, 'Give the category a name'),
  depth: z.number().int().min(0).max(2).optional(),
  parent: z.string().nullable().optional(),
  commissionRate: z.union([z.number(), z.null()]).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
})

export const brandWriteSchema = z.object({
  name: z.string().min(2, 'Give the brand a name'),
  owner: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
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
