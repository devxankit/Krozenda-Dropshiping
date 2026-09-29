import { z } from 'zod'
import { PAYMENT_STATUS, SETTLEMENT_STATUS } from '../constants'

// Runtime contract for the finance & accounting endpoints.
// Money is in PAISE, integer, throughout — a settlement engine that carries
// rupee floats drifts by a few paise every thousand orders.

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

const kpi = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  format: z.enum(['money', 'count', 'percent']),
  delta: z.object({ direction: z.enum(['up', 'down', 'flat']), label: z.string() }).nullable(),
  caption: z.string(),
  tone: z.enum(['default', 'brand']).optional(),
})

export const financeOverviewSchema = z.object({
  kpis: z.array(kpi),
  cashPosition: z.array(
    z.object({ label: z.string(), inflow: z.number(), outflow: z.number() }),
  ),
  holdBuckets: z.array(z.object({ label: z.string(), value: z.number() })),
  attention: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string(),
      amount: z.number(),
      tone: z.enum(['warning', 'danger', 'brand']),
      to: z.string(),
    }),
  ),
})

export const transactionSchema = z.object({
  id: z.string(),
  reference: z.string(),
  orderId: z.string(),
  buyer: z.string(),
  method: z.string(),
  status: z.enum(Object.values(PAYMENT_STATUS)),
  capturedAt: z.string(),
  gross: z.number().int(),
  fee: z.number().int(),
  net: z.number().int(),
  reconciled: z.boolean(),
})

export const transactionListSchema = paged(transactionSchema)

export const refundSchema = z.object({
  id: z.string(),
  reference: z.string(),
  subOrderId: z.string(),
  buyer: z.string(),
  reason: z.string(),
  requestedAt: z.string(),
  isPartial: z.boolean(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'declined']),
  amount: z.number().int(),
  transferReversed: z.boolean(),
})

export const refundListSchema = paged(refundSchema)

export const settlementBatchSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  vendorId: z.string(),
  scheduledFor: z.string(),
  subOrderCount: z.number().int(),
  gross: z.number().int(),
  commission: z.number().int(),
  tds: z.number().int(),
  deductions: z.number().int(),
  net: z.number().int(),
  status: z.enum(Object.values(SETTLEMENT_STATUS)),
  mode: z.string(),
  utr: z.string().nullable(),
})

export const settlementListSchema = paged(settlementBatchSchema)

export const settlementBatchDetailSchema = settlementBatchSchema.extend({
  preparedBy: z.string(),
  preparedAt: z.string(),
  approvalMode: z.enum(['automatic', 'maker_checker']),
  fundAccount: z.object({ bank: z.string(), accountMasked: z.string(), ifsc: z.string() }),
  lines: z.array(
    z.object({
      subOrderId: z.string(),
      deliveredAt: z.string(),
      eligibleAt: z.string(),
      gross: z.number().int(),
      commission: z.number().int(),
      tds: z.number().int(),
      net: z.number().int(),
    }),
  ),
})

export const vendorLedgerListSchema = paged(
  z.object({
    id: z.string(),
    vendor: z.string(),
    model: z.string(),
    opening: z.number().int(),
    credited: z.number().int(),
    debited: z.number().int(),
    closing: z.number().int(),
    lastSettledAt: z.string().nullable(),
  }),
)

export const vendorStatementSchema = z.object({
  vendorId: z.string(),
  vendor: z.string(),
  gstin: z.string(),
  period: z.string(),
  opening: z.number().int(),
  closing: z.number().int(),
  entries: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      particulars: z.string(),
      reference: z.string(),
      debit: z.number().int(),
      credit: z.number().int(),
      balance: z.number().int(),
    }),
  ),
})

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

export const vendorLedgerSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  model: z.string(),
  opening: z.number().int(),
  credited: z.number().int(),
  debited: z.number().int(),
  closing: z.number().int(),
  lastSettledAt: z.string().nullable(),
})

export const reconciledBatchSchema = z.object({ ids: z.array(z.string()) })
