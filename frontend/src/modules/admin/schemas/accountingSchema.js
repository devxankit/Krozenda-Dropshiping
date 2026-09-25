import { z } from 'zod'

// Runtime contract for the Accounting endpoints.
//
// Money is INTEGER PAISE throughout, and the schemas say so with .int() — the
// backend ledger stores paise natively (see backend/Models/AccountingTransaction.js),
// so a float arriving in a money field means something converted on the way
// and this is where that gets caught, loudly, rather than three screens later
// as a total that is off by a paise.
//
// There are no fixtures behind these schemas. Accounting reads the real API
// only (services/accountingService.js), so a schema failure here is a genuine
// backend contract break, never a stale mock.

const money = z.number().int()
// The API hands back Date objects serialised by Express; accept either an ISO
// string or null everywhere a timestamp can be absent.
const timestamp = z.union([z.string(), z.number()]).nullable()

const paged = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    rowsPerPage: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    tabCounts: z.record(z.string(), z.number()),
  })

const range = z
  .object({ from: z.string(), to: z.string(), label: z.string() })
  .nullable()

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const kpi = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  format: z.enum(['money', 'count', 'percent']),
  delta: z.object({ direction: z.enum(['up', 'down', 'flat']), label: z.string() }).nullable(),
  caption: z.string(),
  tone: z.enum(['default', 'brand']).optional(),
})

export const accountingOverviewSchema = z.object({
  range,
  kpis: z.array(kpi),
  salesSummary: z.object({
    grossSales: money,
    discounts: money,
    refunds: money,
    netSales: money,
    orders: z.number().int().nonnegative(),
  }),
  sellerPayableSummary: z.object({
    totalPayable: money,
    settlementPending: money,
    settlementEligible: money,
    onHold: money,
    alreadyPaid: money,
  }),
  paymentSummary: z.object({
    online: money,
    cod: money,
    failed: money,
    refunded: money,
  }),
  recentTransactions: z.array(
    z.object({
      id: z.string(),
      transactionId: z.string(),
      type: z.string(),
      orderId: z.string().nullable(),
      orderNumber: z.string().nullable(),
      seller: z.string(),
      amount: money,
      direction: z.enum(['CREDIT', 'DEBIT']),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
})

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const accountingTransactionSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  orderId: z.string().nullable(),
  orderNumber: z.string().nullable(),
  sellerId: z.string().nullable(),
  seller: z.string(),
  type: z.string(),
  direction: z.enum(['CREDIT', 'DEBIT']),
  credit: money,
  debit: money,
  net: z.number().int(),
  amount: money,
  status: z.string(),
  reference: z.string(),
  referenceType: z.string(),
  paymentMethod: z.string().nullable(),
  createdAt: z.string(),
})

export const accountingTransactionListSchema = paged(accountingTransactionSchema)

export const accountingTransactionDetailSchema = accountingTransactionSchema.extend({
  customerId: z.string().nullable(),
  customer: z.string().nullable(),
  settlementId: z.string().nullable(),
  settlementRef: z.string().nullable(),
  payoutId: z.string().nullable(),
  payoutRef: z.string().nullable(),
  paymentGatewayId: z.string().nullable(),
  refundId: z.string().nullable(),
  reversalOf: z.string().nullable(),
  description: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  currency: z.string(),
  updatedAt: z.string(),
  productName: z.string().nullable(),
  orderSummary: z
    .object({
      subtotal: money,
      discount: money,
      shipping: money,
      total: money,
      paymentMethod: z.string(),
      paymentStatus: z.string(),
      couponCode: z.string().nullable(),
      placedAt: z.string(),
    })
    .nullable(),
  relatedEntries: z.array(
    z.object({
      id: z.string(),
      transactionId: z.string(),
      type: z.string(),
      direction: z.enum(['CREDIT', 'DEBIT']),
      amount: money,
      createdAt: z.string(),
    }),
  ),
})

export const pendingCodListSchema = paged(
  z.object({
    id: z.string(),
    orderId: z.string(),
    orderNumber: z.string(),
    buyer: z.string(),
    amount: money,
    deliveredAt: timestamp,
    sellers: z.number().int().nonnegative(),
  }),
)

export const codRemittanceSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  codRemittedAt: z.string(),
  transactionsPosted: z.number().int().nonnegative(),
})

// ---------------------------------------------------------------------------
// Seller ledger
// ---------------------------------------------------------------------------

export const sellerLedgerRowSchema = z.object({
  id: z.string(),
  seller: z.string(),
  sellerType: z.string().nullable(),
  isActive: z.boolean(),
  totalSales: money,
  totalCommission: money,
  totalFees: money,
  totalRefunds: money,
  totalAdjustments: z.number().int(),
  totalPaid: money,
  currentPayable: z.number().int(),
  onHold: money,
  availableForSettlement: money,
  entries: z.number().int().nonnegative(),
  lastEntryAt: timestamp,
  lastPaidAt: timestamp,
})

export const sellerLedgerListSchema = paged(sellerLedgerRowSchema)

const ledgerEntrySchema = z.object({
  sn: z.number().int().positive(),
  id: z.string(),
  transactionId: z.string(),
  date: z.string(),
  reference: z.string(),
  orderId: z.string().nullable(),
  orderNumber: z.string().nullable(),
  settlementId: z.string().nullable(),
  settlementRef: z.string().nullable(),
  payoutId: z.string().nullable(),
  payoutRef: z.string().nullable(),
  type: z.string(),
  credit: money,
  debit: money,
  runningBalance: z.number().int(),
  description: z.string(),
})

export const sellerLedgerDetailSchema = z.object({
  sellerId: z.string(),
  seller: z.string(),
  sellerType: z.string().nullable(),
  isActive: z.boolean(),
  gstin: z.string(),
  summary: z.object({
    totalSales: money,
    totalCommission: money,
    totalFees: money,
    totalRefunds: money,
    totalAdjustments: z.number().int(),
    totalPaid: money,
    currentPayable: z.number().int(),
    onHold: money,
    availableForSettlement: money,
    settled: money,
  }),
  ledger: paged(ledgerEntrySchema),
})

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export const commissionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number(),
  scope: z.enum(['GLOBAL', 'SELLER', 'CATEGORY', 'PRODUCT']),
  scopeLabel: z.string(),
  target: z.string(),
  sellerId: z.string().nullable(),
  categoryId: z.string().nullable(),
  productId: z.string().nullable(),
  startDate: timestamp,
  endDate: timestamp,
  priority: z.number(),
  isActive: z.boolean(),
  state: z.enum(['ACTIVE', 'SCHEDULED', 'EXPIRED', 'INACTIVE']),
  appliedCount: z.number().int().nonnegative(),
  appliedAmount: money,
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const commissionRuleListSchema = paged(commissionRuleSchema).extend({
  policy: z.object({
    defaultCommissionPercent: z.number(),
    maxCommissionPercent: z.number(),
    commissionBase: z.string(),
  }),
})

const option = z.object({ value: z.string(), label: z.string() })

export const commissionOptionsSchema = z.object({
  sellers: z.array(option),
  categories: z.array(option),
  products: z.array(option),
})

// Off the ledger's COMMISSION and REFUND_REVERSAL rows — see
// adminCommissionController.getCommissionSummary for what each bucket means.
export const commissionSummarySchema = z.object({
  totalCharged: money,
  netCommission: money,
  pending: money,
  earned: money,
  reversed: money,
  cancelled: money,
  thisMonth: money,
  lastMonth: money,
  lines: z.number().int().nonnegative(),
})

const chainScope = z.enum(['PRODUCT', 'SELLER', 'CATEGORY', 'GLOBAL', 'DEFAULT'])

export const commissionPreviewSchema = z.object({
  productName: z.string().nullable(),
  quantity: z.number().int().positive(),
  grossAmount: money,
  discount: money,
  discountFundedBy: z.enum(['SELLER', 'PLATFORM']),
  commissionBasis: z.string(),
  commissionBase: money,
  commissionType: z.enum(['PERCENTAGE', 'FIXED']),
  commissionRate: z.number().nullable(),
  commissionValue: z.number(),
  commissionAmount: money,
  source: chainScope,
  ruleId: z.string().nullable(),
  ruleName: z.string(),
  sellerPayable: money,
  chain: z.array(
    z.object({
      scope: chainScope,
      ruleId: z.string().nullable(),
      ruleName: z.string().nullable(),
      type: z.enum(['PERCENTAGE', 'FIXED']).nullable(),
      value: z.number().nullable(),
      priority: z.number().nullable(),
      applies: z.boolean(),
    }),
  ),
})

export const accountingConfigSchema = z.object({
  defaultCommissionPercent: z.number(),
  maxCommissionPercent: z.number(),
  commissionBase: z.string(),
  gatewayFeePercent: z.number(),
  gatewayFeeFixed: z.number(),
  gatewayFeeBearer: z.enum(['PLATFORM', 'SELLER']),
  shippingRevenueBearer: z.enum(['PLATFORM', 'SELLER']),
  settlementHoldDays: z.number(),
  requireCodRemittanceBeforeSettlement: z.boolean(),
  currency: z.string(),
  updatedAt: z.string(),
  // Optional: not yet in adminCommissionController's serializeConfig
  // whitelist as of this sub-task — see accountingService.js note. Kept
  // optional so this schema doesn't start failing the day the backend adds
  // them, and doesn't fail today while it hasn't.
  sellerSettlementMode: z.enum(['AUTO', 'MANUAL']).optional(),
  sellerSettlementWindowDays: z.number().optional(),
})

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export const settlementSchema = z.object({
  id: z.string(),
  settlementId: z.string(),
  sellerId: z.string(),
  seller: z.string(),
  periodStart: timestamp,
  periodEnd: timestamp,
  lineCount: z.number().int().nonnegative(),
  grossSales: money,
  commission: money,
  fees: money,
  refunds: money,
  adjustments: z.number().int(),
  netPayable: z.number().int(),
  status: z.string(),
  holdReason: z.string(),
  utr: z.string().nullable(),
  payoutRef: z.string().nullable(),
  createdAt: z.string(),
  eligibleAt: timestamp,
  paidAt: timestamp,
})

export const settlementListSchema = paged(settlementSchema)

export const payoutSchema = z.object({
  id: z.string(),
  payoutId: z.string(),
  sellerId: z.string(),
  seller: z.string(),
  settlementId: z.string(),
  settlementRef: z.string(),
  amount: money,
  amountRupees: z.number(),
  method: z.string(),
  bankAccountMasked: z.string(),
  bankName: z.string(),
  ifsc: z.string(),
  accountHolderName: z.string(),
  utr: z.string().nullable(),
  providerReference: z.string().nullable(),
  status: z.string(),
  failureReason: z.string(),
  notes: z.string(),
  attempt: z.number().int().positive(),
  initiatedBy: z.string(),
  createdAt: z.string(),
  processedAt: timestamp,
  // Optional: payoutService.serializePayout does not put these on the wire
  // yet even though Payout.razorpayTransferId/razorpayAccountId exist on the
  // model (see backend/Models/Payout.js) — see accountingService.js note.
  razorpayTransferId: z.string().nullable().optional(),
  razorpayAccountId: z.string().nullable().optional(),
})

export const payoutListSchema = paged(payoutSchema)

export const settlementDetailSchema = settlementSchema.extend({
  gstin: z.string(),
  fundAccount: z.object({
    bankName: z.string(),
    accountMasked: z.string(),
    ifsc: z.string(),
    accountHolderName: z.string(),
    onFile: z.boolean(),
  }),
  lines: z.array(
    z.object({
      sn: z.number().int().positive(),
      orderId: z.string(),
      orderNumber: z.string(),
      productName: z.string(),
      quantity: z.number(),
      paymentMethod: z.string().nullable(),
      deliveredAt: timestamp,
      eligibleAt: timestamp,
      gross: money,
      commission: money,
      fees: money,
      refunds: money,
      net: money,
    }),
  ),
  payouts: z.array(payoutSchema),
})

export const payoutDetailSchema = payoutSchema.extend({
  settlement: z
    .object({
      id: z.string(),
      settlementId: z.string().nullable(),
      netPayable: z.number().int(),
      periodStart: timestamp,
      periodEnd: timestamp,
      status: z.string(),
    })
    .nullable(),
  ledgerTransactionId: z.string().nullable(),
  auditHistory: z.array(
    z.object({
      action: z.string(),
      from: z.string().nullable(),
      to: z.string().nullable(),
      by: z.string(),
      reason: z.string(),
      at: z.string(),
    }),
  ),
})

export const settlementGenerateSchema = z.object({
  generated: z.number().int().nonnegative(),
  items: z.array(settlementSchema),
})

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const accountingRefundSchema = z.object({
  id: z.string(),
  rawId: z.string(),
  kind: z.enum(['RETURN', 'CANCELLATION']),
  refundId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  sellerId: z.string().nullable(),
  seller: z.string(),
  customer: z.string(),
  amount: money,
  refundType: z.enum(['FULL', 'PARTIAL']),
  reason: z.string(),
  paymentMethod: z.string().nullable(),
  status: z.string(),
  ledgerPosted: z.boolean(),
  productName: z.string().nullable(),
  createdAt: z.string(),
  completedAt: timestamp,
  adminNote: z.string(),
  canDecide: z.boolean(),
})

export const accountingRefundListSchema = paged(accountingRefundSchema)

export const accountingRefundDetailSchema = accountingRefundSchema.extend({
  ledgerEntries: z.array(
    z.object({
      id: z.string(),
      transactionId: z.string(),
      type: z.string(),
      direction: z.enum(['CREDIT', 'DEBIT']),
      amount: money,
      description: z.string(),
      createdAt: z.string(),
    }),
  ),
})

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reportCatalogueSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      description: z.string(),
      formats: z.array(z.string()),
    }),
  ),
})

export const reportResultSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  range,
  generatedAt: z.string(),
  columns: z.array(
    z.object({
      key: z.string(),
      header: z.string(),
      format: z.enum(['text', 'money', 'count', 'percent', 'date', 'datetime', 'status']),
    }),
  ),
  // Rows are report-shaped, so the values are validated as primitives rather
  // than against a per-report schema the runner would have to duplicate.
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  totals: z.record(z.string(), z.number()),
})

export const auditLogListSchema = paged(
  z.object({
    id: z.string(),
    action: z.string(),
    admin: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    before: z.unknown().nullable(),
    after: z.unknown().nullable(),
    reason: z.string(),
    ip: z.string(),
    createdAt: z.string(),
  }),
)
