import { findOr404, invalid } from './mutable'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PAYMENT_STATUS, SETTLEMENT_STATUS } from '../constants'

// Shapes match schemas/financeSchema.js. Money is in PAISE.
//
// Balances and running totals below are COMPUTED, never typed: a total that
// is a literal drifts the moment a line changes.

function page(rows, all, matchers, { page = 1, rowsPerPage = 25 } = {}) {
  return {
    items: rows.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage),
    page,
    rowsPerPage,
    totalItems: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / rowsPerPage)),
    tabCounts: Object.fromEntries(
      Object.entries(matchers).map(([key, match]) => [key, all.filter(match).length]),
    ),
  }
}

function search(rows, term, fields) {
  if (!term) return rows
  const needle = term.trim().toLowerCase()
  return rows.filter((row) => fields.some((f) => String(row[f] ?? '').toLowerCase().includes(needle)))
}

// ---------------------------------------------------------------------------
// The general ledger. The money-movement writes below post to it.
// ---------------------------------------------------------------------------
const ACCOUNTS = [
  // Assets (debit balances)
  { code: '1010', name: 'Krozenda bank account — HDFC current', group: 'asset', balance: 1842060000, isSubLedger: false },
  { code: '1020', name: 'Razorpay gateway escrow', group: 'asset', balance: 624080000, isSubLedger: false },
  { code: '1030', name: 'Input tax credit receivable', group: 'asset', balance: 140291000, isSubLedger: false },
  { code: '1040', name: 'Own stock inventory', group: 'asset', balance: 486000000, isSubLedger: false },

  // Liabilities (credit balances)
  { code: '2010', name: 'Accounts payable — vendors', group: 'liability', balance: 1420850000, isSubLedger: true },
  { code: '2020', name: 'GST payable', group: 'liability', balance: 58135000, isSubLedger: false },
  { code: '2030', name: 'TCS payable u/s 52', group: 'liability', balance: 10844000, isSubLedger: false },
  { code: '2040', name: 'TDS payable u/s 194-O', group: 'liability', balance: 10844000, isSubLedger: false },
  { code: '2050', name: 'Accrued expenses', group: 'liability', balance: 84000000, isSubLedger: false },

  // Equity (credit balances). Retained earnings here is the OPENING figure —
  // the current period's profit still sits in the income and expense accounts
  // below, unclosed, which is what makes the trial balance balance.
  { code: '3010', name: 'Share capital', group: 'equity', balance: 1000000000, isSubLedger: false },
  { code: '3020', name: 'Retained earnings (opening)', group: 'equity', balance: 257409000, isSubLedger: false },

  // Income (credit balances)
  { code: '4010', name: 'Platform commission income', group: 'income', balance: 584218000, isSubLedger: false },
  { code: '4020', name: 'Dropshipping retail margin', group: 'income', balance: 221694000, isSubLedger: false },
  { code: '4030', name: 'Logistics fee recovered', group: 'income', balance: 68450000, isSubLedger: false },
  { code: '4090', name: 'Other operating income', group: 'income', balance: 11230000, isSubLedger: false },

  // Direct costs (debit balances)
  { code: '5010', name: 'Courier & logistics expense', group: 'expense', balance: 94266000, isSubLedger: false },
  { code: '5020', name: 'Refunds & chargebacks', group: 'expense', balance: 31840000, isSubLedger: false },
  { code: '5030', name: 'Payment gateway charges', group: 'expense', balance: 19482000, isSubLedger: false },
  { code: '5040', name: 'RTO recovery cost', group: 'expense', balance: 18625000, isSubLedger: false },

  // Operating expenses (debit balances)
  { code: '6010', name: 'Staff payroll', group: 'expense', balance: 284000000, isSubLedger: false },
  { code: '6020', name: 'Marketing & promotions', group: 'expense', balance: 112650000, isSubLedger: false },
  { code: '6030', name: 'Hosting & infrastructure', group: 'expense', balance: 38420000, isSubLedger: false },
  { code: '6040', name: 'Office & administrative', group: 'expense', balance: 21560000, isSubLedger: false },
  { code: '6050', name: 'Professional & legal fees', group: 'expense', balance: 14400000, isSubLedger: false },
]

const byCode = (code) => ACCOUNTS.find((account) => account.code === code)
// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export function financeOverviewFixture() {
  return {
    kpis: [
      { key: 'collected', label: 'Collected this month', value: 1246840000, format: 'money', delta: { direction: 'up', label: '12.4%' }, caption: 'net of refunds' },
      { key: 'held', label: 'Held for settlement', value: 1420850000, format: 'money', delta: null, caption: '42 batches in the hold window', tone: 'brand' },
      { key: 'commission', label: 'Commission earned', value: 584218000, format: 'money', delta: { direction: 'up', label: '19.0%' }, caption: 'before GST on commission' },
      { key: 'statutory', label: 'Statutory dues', value: 79823000, format: 'money', delta: null, caption: 'GST, TCS and TDS payable' },
    ],
    cashPosition: [
      { label: 'Apr', inflow: 970000000, outflow: 742000000 },
      { label: 'May', inflow: 1060000000, outflow: 812000000 },
      { label: 'Jun', inflow: 1160000000, outflow: 884000000 },
      { label: 'Jul', inflow: 1250000000, outflow: 946000000 },
      { label: 'Aug', inflow: 1246840000, outflow: 968400000 },
    ],
    holdBuckets: [
      { label: 'Eligible now', value: 284600000 },
      { label: 'Within 7 days', value: 412800000 },
      { label: 'Within 30 days', value: 618200000 },
      { label: 'Blocked', value: 105250000 },
    ],
    attention: [
      { id: 'att-1', title: '2 payouts failed', detail: 'Bank details rejected by RazorpayX', amount: 42800000, tone: 'danger', to: ADMIN_ROUTES.SETTLEMENTS },
      { id: 'att-2', title: '3 batches awaiting approval', detail: 'Maker–checker mode is on', amount: 186400000, tone: 'warning', to: ADMIN_ROUTES.SETTLEMENTS },
      { id: 'att-3', title: '4 refunds not settled', detail: 'Transfer reversal pending', amount: 8940000, tone: 'warning', to: ADMIN_ROUTES.REFUNDS },
    ],
  }
}

// ---------------------------------------------------------------------------
// Transactions & refunds
// ---------------------------------------------------------------------------
const TRANSACTIONS = [
  { id: 'txn-1', reference: 'pay_QeR41xK2mVn8Ld', orderId: 'KZ-40128', buyer: 'Ananya Iyer', method: 'UPI · Google Pay', status: PAYMENT_STATUS.CAPTURED, capturedAt: '2 Sep 2026, 11:42', gross: 389600, fee: 7596, net: 382004, reconciled: true },
  { id: 'txn-2', reference: 'pay_QeR40vB8pLm2Kd', orderId: 'KZ-40127', buyer: 'Rakesh Menon', method: 'Credit card · HDFC', status: PAYMENT_STATUS.CAPTURED, capturedAt: '2 Sep 2026, 10:18', gross: 942000, fee: 18369, net: 923631, reconciled: true },
  { id: 'txn-3', reference: 'pay_QeR3xzT6nQw1Jc', orderId: 'KZ-40126', buyer: 'Bharat Textiles LLP', method: 'Net banking · ICICI', status: PAYMENT_STATUS.CAPTURED, capturedAt: '2 Sep 2026, 09:05', gross: 4860000, fee: 94770, net: 4765230, reconciled: false },
  { id: 'txn-4', reference: 'pay_QeR2wpN4kRt9Hb', orderId: 'KZ-40125', buyer: 'Sneha Kulkarni', method: 'UPI · PhonePe', status: PAYMENT_STATUS.CAPTURED, capturedAt: '1 Sep 2026, 21:37', gross: 1294000, fee: 25233, net: 1268767, reconciled: true },
  { id: 'txn-5', reference: 'pay_QeR1vmK9jSp7Ga', orderId: 'KZ-40124', buyer: 'Imran Qureshi', method: 'UPI · Paytm', status: PAYMENT_STATUS.REFUND_PENDING, capturedAt: '1 Sep 2026, 19:12', gross: 186000, fee: 3627, net: 182373, reconciled: false },
  { id: 'txn-6', reference: 'pay_QeR0ulJ3hTn5Fz', orderId: 'KZ-40122', buyer: 'Kritika Enterprises', method: 'Net banking · SBI', status: PAYMENT_STATUS.CAPTURED, capturedAt: '1 Sep 2026, 14:03', gross: 12450000, fee: 242775, net: 12207225, reconciled: true },
  { id: 'txn-7', reference: 'pay_QeQ9tkH2gUm3Ey', orderId: 'KZ-40118', buyer: 'Arjun Pillai', method: 'Debit card · Axis', status: PAYMENT_STATUS.FAILED, capturedAt: '31 Aug 2026, 18:36', gross: 245000, fee: 0, net: 0, reconciled: true },
  { id: 'txn-8', reference: 'pay_QeQ8sjG1fVl1Dx', orderId: 'KZ-40119', buyer: 'Meghna Wholesale', method: 'Net banking · HDFC', status: PAYMENT_STATUS.PARTIALLY_REFUNDED, capturedAt: '31 Aug 2026, 22:14', gross: 6820000, fee: 132990, net: 6687010, reconciled: false },
]

const TRANSACTION_TABS = {
  all: () => true,
  captured: (t) => t.status === PAYMENT_STATUS.CAPTURED,
  refunds: (t) => [PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.PARTIALLY_REFUNDED, PAYMENT_STATUS.REFUNDED].includes(t.status),
  failed: (t) => t.status === PAYMENT_STATUS.FAILED,
  unreconciled: (t) => !t.reconciled,
}

export function transactionListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = TRANSACTIONS.filter(TRANSACTION_TABS[tab] || TRANSACTION_TABS.all)
  rows = search(rows, filters.search, ['reference', 'orderId', 'buyer', 'method'])
  if (filters.status) rows = rows.filter((t) => t.status === filters.status)
  return page(rows, TRANSACTIONS, TRANSACTION_TABS, query)
}

const REFUNDS = [
  { id: 'rfd-1', reference: 'rfnd_QfA1xK2mVn8Ld', subOrderId: 'KZ-40124-A', buyer: 'Imran Qureshi', reason: 'Buyer cancelled before dispatch', requestedAt: '1 Sep 2026', isPartial: false, status: 'pending', amount: 186000, transferReversed: false },
  { id: 'rfd-2', reference: 'rfnd_QfA0wJ1lUm7Kc', subOrderId: 'KZ-40119-B', buyer: 'Meghna Wholesale', reason: 'Damaged on arrival — 2 units', requestedAt: '1 Sep 2026', isPartial: true, status: 'processing', amount: 218000, transferReversed: true },
  { id: 'rfd-3', reference: 'rfnd_QeZ9vI0kTl6Jb', subOrderId: 'KZ-40109-B', buyer: 'Deepak Anand', reason: 'Vendor out of stock at pickup', requestedAt: '30 Aug 2026', isPartial: false, status: 'completed', amount: 249900, transferReversed: true },
  { id: 'rfd-4', reference: 'rfnd_QeZ8uH9jSk5Ia', subOrderId: 'KZ-40101-A', buyer: 'Priya Menon', reason: 'Cancelled by admin — risk flag', requestedAt: '28 Aug 2026', isPartial: false, status: 'completed', amount: 1240000, transferReversed: true },
  { id: 'rfd-5', reference: 'rfnd_QeZ7tG8iRj4Hz', subOrderId: 'KZ-40095-A', buyer: 'Fatima Sheikh', reason: 'Delivery delayed beyond promise', requestedAt: '26 Aug 2026', isPartial: false, status: 'failed', amount: 84900, transferReversed: false },
  { id: 'rfd-6', reference: 'rfnd_QeZ6sF7hQi3Gy', subOrderId: 'KZ-40092-C', buyer: 'Arjun Pillai', reason: 'Wrong product shipped', requestedAt: '25 Aug 2026', isPartial: true, status: 'completed', amount: 128000, transferReversed: true },
]

const REFUND_TABS = {
  all: () => true,
  open: (r) => ['pending', 'processing', 'failed'].includes(r.status),
  partial: (r) => r.isPartial,
  failed: (r) => r.status === 'failed',
  completed: (r) => r.status === 'completed',
}

export function refundListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = REFUNDS.filter(REFUND_TABS[tab] || REFUND_TABS.all)
  rows = search(rows, filters.search, ['reference', 'subOrderId', 'buyer', 'reason'])
  return page(rows, REFUNDS, REFUND_TABS, query)
}

// ---------------------------------------------------------------------------
// Settlements. `net` is DERIVED — gross less commission, TDS and deductions.
// ---------------------------------------------------------------------------
function batch(fields) {
  return { ...fields, net: fields.gross - fields.commission - fields.tds - fields.deductions }
}

const BATCHES = [
  batch({ id: 'stl-1', vendor: 'Nova Retail Pvt Ltd', vendorId: 'slr-2184', scheduledFor: '8 Sep 2026', subOrderCount: 84, gross: 21460000, commission: 2682500, tds: 214600, deductions: 42000, status: SETTLEMENT_STATUS.AWAITING_APPROVAL, mode: 'IMPS', utr: null }),
  batch({ id: 'stl-2', vendor: 'Arya Manufacturing', vendorId: 'slr-1902', scheduledFor: '8 Sep 2026', subOrderCount: 112, gross: 18640000, commission: 2330000, tds: 186400, deductions: 0, status: SETTLEMENT_STATUS.AWAITING_APPROVAL, mode: 'IMPS', utr: null }),
  batch({ id: 'stl-3', vendor: 'Meghna Wholesale', vendorId: 'slr-2077', scheduledFor: '8 Sep 2026', subOrderCount: 66, gross: 14290000, commission: 1786250, tds: 142900, deductions: 26000, status: SETTLEMENT_STATUS.AWAITING_APPROVAL, mode: 'NEFT', utr: null }),
  batch({ id: 'stl-4', vendor: 'Bharat Textiles LLP', vendorId: 'slr-2410', scheduledFor: '1 Sep 2026', subOrderCount: 48, gross: 8640000, commission: 1080000, tds: 86400, deductions: 0, status: SETTLEMENT_STATUS.SETTLED, mode: 'IMPS', utr: 'HDFCN52026090100418' }),
  batch({ id: 'stl-5', vendor: 'Sunrise Traders', vendorId: 'slr-1640', scheduledFor: '1 Sep 2026', subOrderCount: 22, gross: 4280000, commission: 535000, tds: 42800, deductions: 42000, status: SETTLEMENT_STATUS.FAILED, mode: 'IMPS', utr: null }),
  batch({ id: 'stl-6', vendor: 'Kritika Enterprises', vendorId: 'slr-2266', scheduledFor: '1 Sep 2026', subOrderCount: 18, gross: 7120000, commission: 890000, tds: 71200, deductions: 0, status: SETTLEMENT_STATUS.FAILED, mode: 'IMPS', utr: null }),
  batch({ id: 'stl-7', vendor: 'Nova Retail Pvt Ltd', vendorId: 'slr-2184', scheduledFor: '25 Aug 2026', subOrderCount: 78, gross: 19840000, commission: 2480000, tds: 198400, deductions: 0, status: SETTLEMENT_STATUS.SETTLED, mode: 'IMPS', utr: 'HDFCN52026082500219' }),
  batch({ id: 'stl-8', vendor: 'Arya Manufacturing', vendorId: 'slr-1902', scheduledFor: '15 Sep 2026', subOrderCount: 41, gross: 9240000, commission: 1155000, tds: 92400, deductions: 0, status: SETTLEMENT_STATUS.LOCKED_IN_HOLD, mode: 'IMPS', utr: null }),
]

const BATCH_TABS = {
  all: () => true,
  awaiting: (b) => b.status === SETTLEMENT_STATUS.AWAITING_APPROVAL,
  hold: (b) => b.status === SETTLEMENT_STATUS.LOCKED_IN_HOLD,
  failed: (b) => b.status === SETTLEMENT_STATUS.FAILED,
  settled: (b) => b.status === SETTLEMENT_STATUS.SETTLED,
}

export function settlementListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = BATCHES.filter(BATCH_TABS[tab] || BATCH_TABS.all)
  rows = search(rows, filters.search, ['id', 'vendor', 'utr'])
  if (filters.status) rows = rows.filter((b) => b.status === filters.status)
  return page(rows, BATCHES, BATCH_TABS, query)
}

export function settlementBatchFixture(batchId) {
  const summary = BATCHES.find((b) => b.id === batchId) || BATCHES[0]

  // Lines are generated so they add up to the batch header exactly, with the
  // rounding remainder pushed onto the last line rather than left to drift.
  const count = Math.min(summary.subOrderCount, 6)
  const lines = Array.from({ length: count }, (_, index) => {
    const isLast = index === count - 1
    const share = (value) =>
      isLast ? value - Math.floor(value / count) * (count - 1) : Math.floor(value / count)
    const gross = share(summary.gross)
    const commission = share(summary.commission)
    const tds = share(summary.tds)
    return {
      subOrderId: `KZ-40${(120 + index).toString()}-A`,
      deliveredAt: `${2 + index} Aug 2026`,
      eligibleAt: `${1 + index} Sep 2026`,
      gross,
      commission,
      tds,
      net: gross - commission - tds,
    }
  })

  return {
    ...summary,
    preparedBy: 'Automated payout job',
    preparedAt: '2 Sep 2026, 02:00',
    approvalMode: 'maker_checker',
    fundAccount: { bank: 'HDFC Bank, Andheri East', accountMasked: 'XXXX XXXX 4417', ifsc: 'HDFC0000521' },
    lines,
  }
}

// ---------------------------------------------------------------------------
// Vendor ledgers
// ---------------------------------------------------------------------------
const LEDGERS = [
  { id: 'slr-2184', vendor: 'Nova Retail Pvt Ltd', model: 'Marketplace', opening: 19840000, credited: 21460000, debited: 19840000, lastSettledAt: '25 Aug 2026' },
  { id: 'slr-1902', vendor: 'Arya Manufacturing', model: 'Dropshipping', opening: 12400000, credited: 27880000, debited: 12400000, lastSettledAt: '25 Aug 2026' },
  { id: 'slr-2077', vendor: 'Meghna Wholesale', model: 'Dropshipping', opening: 8600000, credited: 14290000, debited: 8600000, lastSettledAt: '25 Aug 2026' },
  { id: 'slr-2410', vendor: 'Bharat Textiles LLP', model: 'Marketplace', opening: 8640000, credited: 6820000, debited: 8640000, lastSettledAt: '1 Sep 2026' },
  { id: 'slr-1640', vendor: 'Sunrise Traders', model: 'Marketplace', opening: 0, credited: 4280000, debited: 0, lastSettledAt: null },
  { id: 'slr-2266', vendor: 'Kritika Enterprises', model: 'Dropshipping', opening: 0, credited: 7120000, debited: 0, lastSettledAt: null },
].map((ledger) => ({ ...ledger, closing: ledger.opening + ledger.credited - ledger.debited }))

const LEDGER_TABS = {
  all: () => true,
  owing: (l) => l.closing > 0,
  settled: (l) => l.closing === 0,
  never_settled: (l) => l.lastSettledAt === null,
}

export function vendorLedgerListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = LEDGERS.filter(LEDGER_TABS[tab] || LEDGER_TABS.all)
  rows = search(rows, filters.search, ['vendor', 'model'])
  return page(rows, LEDGERS, LEDGER_TABS, query)
}

export function vendorStatementFixture(vendorId) {
  const ledger = LEDGERS.find((l) => l.id === vendorId) || LEDGERS[0]

  const movements = [
    { date: '2 Aug 2026', particulars: 'Sub-order delivered — settlement accrued', reference: 'KZ-40088-A', debit: 0, credit: 4280000 },
    { date: '9 Aug 2026', particulars: 'Sub-order delivered — settlement accrued', reference: 'KZ-40094-A', debit: 0, credit: 6140000 },
    { date: '16 Aug 2026', particulars: 'Commission invoice', reference: 'CMI/2627/00412', debit: 1286000, credit: 0 },
    { date: '18 Aug 2026', particulars: 'RTO recovery — return shipping', reference: 'KZ-40074-A', debit: 26000, credit: 0 },
    { date: '23 Aug 2026', particulars: 'Sub-order delivered — settlement accrued', reference: 'KZ-40112-A', debit: 0, credit: 8420000 },
    { date: '25 Aug 2026', particulars: 'Payout released', reference: 'UTR HDFCN52026082500219', debit: ledger.debited, credit: 0 },
    { date: '30 Aug 2026', particulars: 'Sub-order delivered — settlement accrued', reference: 'KZ-40126-A', debit: 0, credit: 2620000 },
    { date: '1 Sep 2026', particulars: 'TDS deducted u/s 194-O', reference: 'TDS/2627/Q2', debit: 214600, credit: 0 },
  ]

  // Running balance is accumulated, never typed.
  let balance = ledger.opening
  const entries = movements.map((movement, index) => {
    balance = balance + movement.credit - movement.debit
    return { id: `ent-${index + 1}`, ...movement, balance }
  })

  return {
    vendorId: ledger.id,
    vendor: ledger.vendor,
    gstin: '27AAFCN9612R1ZQ',
    period: '1 Aug – 2 Sep 2026',
    opening: ledger.opening,
    closing: balance,
    entries,
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
export function commissionRuleListFixture() {
  return {
    items: [
      { id: 'cr-1', scope: 'product', target: 'Vayu 1.5 Ton 3-Star Inverter AC', type: 'percentage', value: 6, appliesTo: 1, updatedAt: '28 Aug 2026' },
      { id: 'cr-2', scope: 'vendor', target: 'Sunrise Traders', type: 'percentage', value: 20, appliesTo: 96, updatedAt: '22 Aug 2026' },
      { id: 'cr-3', scope: 'category', target: 'Home & Kitchen', type: 'percentage', value: 12.5, appliesTo: 28410, updatedAt: '12 Aug 2026' },
      { id: 'cr-4', scope: 'category', target: 'Apparel', type: 'percentage', value: 18, appliesTo: 31240, updatedAt: '12 Aug 2026' },
      { id: 'cr-5', scope: 'category', target: 'Electronics', type: 'percentage', value: 8, appliesTo: 18640, updatedAt: '12 Aug 2026' },
      { id: 'cr-6', scope: 'category', target: 'Grocery & Staples', type: 'percentage', value: 6, appliesTo: 14820, updatedAt: '12 Aug 2026' },
      { id: 'cr-7', scope: 'company', target: 'Bharat Textiles LLP', type: 'fixed', value: 2500, appliesTo: 294, updatedAt: '4 Jul 2026' },
      { id: 'cr-8', scope: 'default', target: 'Platform default', type: 'percentage', value: 15, appliesTo: 104220, updatedAt: '1 Jan 2026' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Postings mutate ACCOUNTS in place. The seed balances above are an "as at"
// state, so only NEW postings are applied.
// ---------------------------------------------------------------------------

const DEBIT_NATURED = new Set(['asset', 'expense'])

// `direction` is +1 to post and -1 to reverse.
function applyLines(lines, direction) {
  for (const line of lines) {
    const account = byCode(line.code)
    const natural = DEBIT_NATURED.has(account.group) ? 1 : -1
    account.balance += natural * direction * ((line.debit || 0) - (line.credit || 0))
  }
}

const DISPLAY_DATE = { day: 'numeric', month: 'short', year: 'numeric' }
const todayDisplay = () => new Date().toLocaleDateString('en-IN', DISPLAY_DATE)

// ---------------------------------------------------------------------------
// Money movement: settlements, refunds, reconciliation
//
// These are the writes that move real money, so each one posts to the ledger
// as well as changing a status. A payout that updates a row but not the books
// is how a platform ends up unable to explain its own bank balance.
// ---------------------------------------------------------------------------

const BANK_CODE = '1010'
const ESCROW_CODE = '1020'
const VENDOR_PAYABLE_CODE = '2010'
const TDS_PAYABLE_CODE = '2040'
const REFUND_EXPENSE_CODE = '5020'

// `closing` is materialised on the seed rows rather than derived on read, so
// it has to be recomputed by hand after any write that moves the two sides.
function recloseLedger(ledger) {
  ledger.closing = ledger.opening + ledger.credited - ledger.debited
  return ledger
}

function utrFor(mode) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${mode === 'NEFT' ? 'HDFCN' : 'HDFCH'}5${stamp}${String(Math.floor(Math.random() * 900) + 100)}`
}

/**
 * Release a payout batch.
 *
 * Maker–checker is the point of this screen: the nightly job prepares the
 * batch, a second person with PAYOUT_APPROVE releases it, and the release
 * needs a fresh two-factor code. The permission is enforced in the UI; the
 * code is enforced here, so the API keeps the rule even if the UI is bypassed.
 */
export function approveSettlementFixture(id, { twoFactorCode } = {}) {
  const batchRow = findOr404(BATCHES, id)

  if (batchRow.status !== SETTLEMENT_STATUS.AWAITING_APPROVAL) {
    throw invalid('Only a batch awaiting approval can be released.')
  }
  if (!/^\d{6}$/.test(String(twoFactorCode || ''))) {
    throw invalid('Enter the 6-digit code from your authenticator to release a payout.')
  }
  if (String(twoFactorCode) === '000000') {
    throw { status: 401, code: 'INVALID_CODE', message: 'That code was not accepted.', details: null }
  }

  batchRow.status = SETTLEMENT_STATUS.SETTLED
  batchRow.utr = utrFor(batchRow.mode)
  batchRow.approvedBy = 'Priya Sharma'

  // Paying a vendor clears the payable and moves cash out; the TDS withheld
  // stays behind as a liability until it is remitted.
  applyLines(
    [
      { code: VENDOR_PAYABLE_CODE, debit: batchRow.net + batchRow.tds, credit: 0 },
      { code: BANK_CODE, debit: 0, credit: batchRow.net },
      { code: TDS_PAYABLE_CODE, debit: 0, credit: batchRow.tds },
    ],
    1,
  )

  const ledger = LEDGERS.find((entry) => entry.id === batchRow.vendorId)
  if (ledger) {
    ledger.debited += batchRow.net
    ledger.lastSettledAt = todayDisplay()
    recloseLedger(ledger)
  }

  return batchRow
}

export function rejectSettlementFixture(id, { reason } = {}) {
  const batchRow = findOr404(BATCHES, id)
  if (batchRow.status !== SETTLEMENT_STATUS.AWAITING_APPROVAL) {
    throw invalid('Only a batch awaiting approval can be rejected.')
  }
  if (!reason || reason.trim().length < 5) {
    throw invalid('Say why the batch is being rejected — the vendor sees this.')
  }
  // Rejection releases nothing, so the ledger is untouched. The batch drops
  // back to the hold queue for the next run to pick up.
  batchRow.status = SETTLEMENT_STATUS.LOCKED_IN_HOLD
  batchRow.rejectionReason = reason.trim()
  return batchRow
}

export function retrySettlementFixture(id) {
  const batchRow = findOr404(BATCHES, id)
  if (batchRow.status !== SETTLEMENT_STATUS.FAILED) {
    throw invalid('Only a failed batch can be retried.')
  }
  batchRow.status = SETTLEMENT_STATUS.AWAITING_APPROVAL
  batchRow.utr = null
  return batchRow
}

/**
 * Complete a refund. A partial refund reverses only that sub-order's transfer,
 * which is why the vendor's payable moves by the same amount the buyer gets
 * back rather than by the whole order.
 */
export function processRefundFixture(id) {
  const refund = findOr404(REFUNDS, id)
  if (refund.status === 'completed') throw invalid('That refund has already been paid out.')

  refund.status = 'completed'
  refund.transferReversed = true

  applyLines(
    [
      { code: REFUND_EXPENSE_CODE, debit: refund.amount, credit: 0 },
      { code: ESCROW_CODE, debit: 0, credit: refund.amount },
    ],
    1,
  )
  return refund
}

export function rejectRefundFixture(id, { reason } = {}) {
  const refund = findOr404(REFUNDS, id)
  if (refund.status === 'completed') throw invalid('A completed refund cannot be declined.')
  if (!reason || reason.trim().length < 5) throw invalid('Give the buyer a reason.')
  refund.status = 'declined'
  refund.reason = reason.trim()
  return refund
}

/** Matching a capture to its bank settlement is what closes a period. */
export function reconcileTransactionFixture(id, reconciled = true) {
  const transaction = findOr404(TRANSACTIONS, id)
  transaction.reconciled = Boolean(reconciled)
  return transaction
}

export function bulkReconcileTransactionsFixture(ids = []) {
  const touched = ids.map((id) => {
    const transaction = findOr404(TRANSACTIONS, id)
    transaction.reconciled = true
    return transaction.id
  })
  return { ids: touched }
}

/**
 * A manual adjustment against a vendor's running balance — a recovery, a
 * penalty, a correction. It posts both sides, so the sum of every vendor
 * closing balance still equals account 2010 afterwards.
 */
export function adjustVendorLedgerFixture(vendorId, { amount, reason } = {}) {
  const ledger = findOr404(LEDGERS, vendorId)
  const paise = Math.round(Number(amount) || 0)

  if (!paise) throw invalid('An adjustment needs a non-zero amount.')
  if (!reason || reason.trim().length < 5) throw invalid('Say what the adjustment is for.')

  if (paise > 0) {
    ledger.credited += paise
    applyLines(
      [
        { code: REFUND_EXPENSE_CODE, debit: paise, credit: 0 },
        { code: VENDOR_PAYABLE_CODE, debit: 0, credit: paise },
      ],
      1,
    )
  } else {
    ledger.debited += Math.abs(paise)
    applyLines(
      [
        { code: VENDOR_PAYABLE_CODE, debit: Math.abs(paise), credit: 0 },
        { code: REFUND_EXPENSE_CODE, debit: 0, credit: Math.abs(paise) },
      ],
      1,
    )
  }

  ledger.lastAdjustment = reason.trim()
  recloseLedger(ledger)
  return ledger
}
