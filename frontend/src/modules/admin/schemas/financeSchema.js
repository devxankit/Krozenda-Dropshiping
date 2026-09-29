import { z } from 'zod'

// Runtime contract for the finance & accounting endpoints.
// Money is in PAISE, integer, throughout — a settlement engine that carries
// rupee floats drifts by a few paise every thousand orders.

export const commissionRuleListSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      scope: z.enum(['product', 'vendor', 'category', 'company', 'default']),
      target: z.string(),
      type: z.enum(['percentage', 'fixed']),
      value: z.number(),
      appliesTo: z.number().int(),
      updatedAt: z.string(),
    }),
  ),
})

// ---------------------------------------------------------------------------
// What the money-movement writes echo back.
// ---------------------------------------------------------------------------
