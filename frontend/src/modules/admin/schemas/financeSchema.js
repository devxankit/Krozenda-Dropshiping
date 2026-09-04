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

export const pricingRuleListSchema = z.object({
  tiers: z.array(
    z.object({
      role: z.string(),
      label: z.string(),
      discountFromRetail: z.number(),
      minQty: z.number().int(),
      products: z.number().int(),
    }),
  ),
  rules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(['discount', 'markup', 'shipping']),
      condition: z.string(),
      effect: z.string(),
      active: z.boolean(),
    }),
  ),
})

const account = z.object({
  code: z.string(),
  name: z.string(),
  group: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  balance: z.number().int(),
  isSubLedger: z.boolean(),
  isActive: z.boolean().optional(),
})

export const chartOfAccountsSchema = z.object({ accounts: z.array(account) })

// One side of a double entry. A line carries a debit or a credit, never both
// — the form enforces it, and so does the fixture, so the API can too.
const voucherLine = z.object({
  code: z.string(),
  debit: z.number().int().min(0),
  credit: z.number().int().min(0),
})

export const journalVoucherListSchema = paged(
  z.object({
    id: z.string(),
    number: z.string(),
    date: z.string(),
    narration: z.string(),
    postedBy: z.string(),
    debit: z.number().int(),
    credit: z.number().int(),
    status: z.enum(['draft', 'posted', 'reversed']),
    lines: z.array(voucherLine).optional(),
  }),
)

export const expenseListSchema = paged(
  z.object({
    id: z.string(),
    date: z.string(),
    category: z.string(),
    vendor: z.string(),
    narration: z.string(),
    amount: z.number().int(),
    gst: z.number().int(),
    itcClaimable: z.boolean(),
    status: z.enum(['draft', 'posted', 'paid']),
  }),
)

const statementLine = z.object({
  label: z.string(),
  current: z.number().int(),
  prior: z.number().int(),
  kind: z.enum(['group', 'line', 'subtotal', 'total']),
})

export const statementSchema = z.object({
  title: z.string(),
  period: z.string(),
  basis: z.string(),
  lines: z.array(statementLine),
  unreconciled: z.number().int(),
})

export const trialBalanceSchema = z.object({
  period: z.string(),
  rows: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      debit: z.number().int(),
      credit: z.number().int(),
    }),
  ),
})

export const taxCentreSchema = z.object({
  position: z.array(z.object({ label: z.string(), value: z.number().int(), emphasis: z.boolean() })),
  returns: z.array(
    z.object({
      id: z.string(),
      form: z.string(),
      description: z.string(),
      period: z.string(),
      dueOn: z.string(),
      status: z.enum(['due', 'draft', 'filed', 'overdue']),
      formats: z.array(z.string()),
    }),
  ),
})

// ---------------------------------------------------------------------------
// Write contracts. These validate the form before it submits AND the payload
// the API will receive, so the two cannot drift apart.
// ---------------------------------------------------------------------------

const sumBy = (lines, key) => lines.reduce((total, line) => total + (line[key] || 0), 0)

export const journalVoucherWriteSchema = z
  .object({
    date: z.string().min(1, 'Pick a date'),
    narration: z.string().min(3, 'Say what this posting is for'),
    status: z.enum(['draft', 'posted']),
    lines: z.array(voucherLine).min(2, 'A voucher needs at least two lines'),
  })
  .superRefine((value, ctx) => {
    const usable = value.lines.filter((line) => line.code && (line.debit > 0 || line.credit > 0))

    if (usable.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Enter at least one debit and one credit.' })
      return
    }
    for (const line of value.lines) {
      if (line.debit > 0 && line.credit > 0) {
        ctx.addIssue({ code: 'custom', path: ['lines'], message: 'A line takes a debit or a credit, not both.' })
        return
      }
    }
    if (sumBy(usable, 'debit') !== sumBy(usable, 'credit')) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'Debits must equal credits.' })
    }
  })

export const expenseWriteSchema = z.object({
  date: z.string().min(1, 'Pick a date'),
  category: z.string().min(1, 'Pick a category'),
  vendor: z.string().min(2, 'Who was this paid to?'),
  narration: z.string().min(3, 'Say what this was for'),
  amount: z.number().int().positive('Enter an amount above zero'),
  gst: z.number().int().min(0),
  itcClaimable: z.boolean(),
  status: z.enum(['draft', 'posted', 'paid']),
})

export const accountWriteSchema = z.object({
  code: z.string().regex(/^\d{4}$/, 'An account code is four digits'),
  name: z.string().min(3, 'Give the account a name'),
  group: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  isSubLedger: z.boolean(),
})

export const accountOptionsSchema = z.object({
  accounts: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      group: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
    }),
  ),
  expenseCategories: z.array(z.string()),
})

// Writes echo the saved row back, so a list can be updated without a refetch
// if it ever needs to be.
export const journalVoucherSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: z.string(),
  narration: z.string(),
  postedBy: z.string(),
  debit: z.number().int(),
  credit: z.number().int(),
  status: z.enum(['draft', 'posted', 'reversed']),
  lines: z.array(voucherLine),
})

export const expenseSchema = z.object({
  id: z.string(),
  date: z.string(),
  category: z.string(),
  vendor: z.string(),
  narration: z.string(),
  amount: z.number().int(),
  gst: z.number().int(),
  itcClaimable: z.boolean(),
  status: z.enum(['draft', 'posted', 'paid']),
})

export const accountSchema = z.object({
  code: z.string(),
  name: z.string(),
  group: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  balance: z.number().int(),
  isSubLedger: z.boolean(),
  isActive: z.boolean().optional(),
})

export const deletedSchema = z.object({ id: z.string() })

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
