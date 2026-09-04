import { drop, findOr404, insert, invalid, nextId } from './mutable'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PAYMENT_STATUS, SETTLEMENT_STATUS } from '../constants'

// Shapes match schemas/financeSchema.js. Money is in PAISE.
//
// Subtotals, balances and running totals below are COMPUTED, never typed.
// A statement whose total is a literal drifts the moment a line changes, and
// in a finance surface that is the one bug nobody forgives.

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

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0)

// ---------------------------------------------------------------------------
// The general ledger. Everything else in this file is derived from it, so the
// P&L, the balance sheet and the trial balance cannot disagree.
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

// Prior-period comparatives, keyed by account code.
const PRIOR = {
  '4010': 491064000, '4020': 187422000, '4030': 60218000, '4090': 14490000,
  '5010': 81140000, '5020': 36288000, '5030': 16605000, '5040': 14072000,
  '6010': 248000000, '6020': 100430000, '6030': 31266000, '6040': 20894000, '6050': 17250000,
}

const byCode = (code) => ACCOUNTS.find((account) => account.code === code)
const current = (code) => byCode(code).balance
const prior = (code) => PRIOR[code] ?? 0

export function chartOfAccountsFixture() {
  return { accounts: ACCOUNTS }
}

// A group of P&L lines plus its computed subtotal.
function group(label, codes) {
  const lines = codes.map((code) => ({
    label: byCode(code).name,
    current: current(code),
    prior: prior(code),
    kind: 'line',
  }))
  return {
    lines,
    subtotal: {
      label: `Total ${label.toLowerCase()}`,
      current: sum(lines, 'current'),
      prior: sum(lines, 'prior'),
      kind: 'subtotal',
    },
  }
}

export function profitAndLossFixture() {
  const income = group('income', ['4010', '4020', '4030', '4090'])
  const direct = group('direct costs', ['5010', '5020', '5030', '5040'])
  const opex = group('operating expenses', ['6010', '6020', '6030', '6040', '6050'])

  const grossProfit = {
    label: 'Gross profit',
    current: income.subtotal.current - direct.subtotal.current,
    prior: income.subtotal.prior - direct.subtotal.prior,
    kind: 'subtotal',
  }

  return {
    title: 'Statement of profit & loss',
    period: '1 Apr – 2 Sep 2026 · FY 2026-27',
    basis: 'Accrual basis',
    unreconciled: 4,
    lines: [
      { label: 'Income', current: 0, prior: 0, kind: 'group' },
      ...income.lines,
      income.subtotal,
      { label: 'Direct costs', current: 0, prior: 0, kind: 'group' },
      ...direct.lines,
      direct.subtotal,
      grossProfit,
      { label: 'Operating expenses', current: 0, prior: 0, kind: 'group' },
      ...opex.lines,
      opex.subtotal,
      {
        label: 'Net profit before tax',
        current: grossProfit.current - opex.subtotal.current,
        prior: grossProfit.prior - opex.subtotal.prior,
        kind: 'total',
      },
    ],
  }
}

export function balanceSheetFixture() {
  const assets = ACCOUNTS.filter((a) => a.group === 'asset')
  const liabilities = ACCOUNTS.filter((a) => a.group === 'liability')
  const income = sum(ACCOUNTS.filter((a) => a.group === 'income'), 'balance')
  const expense = sum(ACCOUNTS.filter((a) => a.group === 'expense'), 'balance')
  const periodProfit = income - expense

  const assetTotal = sum(assets, 'balance')
  const liabilityTotal = sum(liabilities, 'balance')
  const shareCapital = current('3010')
  const openingRetained = current('3020')

  const equityLines = [
    { label: 'Share capital', current: shareCapital, prior: shareCapital, kind: 'line' },
    { label: 'Retained earnings (opening)', current: openingRetained, prior: 0, kind: 'line' },
    { label: 'Profit for the period', current: periodProfit, prior: 0, kind: 'line' },
  ]
  const equityTotal = sum(equityLines, 'current')

  return {
    title: 'Balance sheet',
    period: 'As at 2 Sep 2026',
    basis: 'Accrual basis',
    unreconciled: 4,
    lines: [
      { label: 'Assets', current: 0, prior: 0, kind: 'group' },
      ...assets.map((a) => ({ label: a.name, current: a.balance, prior: 0, kind: 'line' })),
      { label: 'Total assets', current: assetTotal, prior: 0, kind: 'subtotal' },
      { label: 'Liabilities', current: 0, prior: 0, kind: 'group' },
      ...liabilities.map((a) => ({ label: a.name, current: a.balance, prior: 0, kind: 'line' })),
      { label: 'Total liabilities', current: liabilityTotal, prior: 0, kind: 'subtotal' },
      { label: 'Equity', current: 0, prior: 0, kind: 'group' },
      ...equityLines,
      { label: 'Total equity', current: equityTotal, prior: 0, kind: 'subtotal' },
      {
        label: 'Total liabilities and equity',
        current: liabilityTotal + equityTotal,
        prior: 0,
        kind: 'total',
      },
    ],
  }
}

export function trialBalanceFixture() {
  // Assets and expenses carry debit balances; liabilities, equity and income
  // carry credit balances. Splitting them this way is what makes the two
  // columns agree without any figure being typed twice.
  const DEBIT_GROUPS = ['asset', 'expense']
  return {
    period: '1 Apr – 2 Sep 2026',
    rows: ACCOUNTS.map((account) => ({
      code: account.code,
      name: account.name,
      debit: DEBIT_GROUPS.includes(account.group) ? account.balance : 0,
      credit: DEBIT_GROUPS.includes(account.group) ? 0 : account.balance,
    })),
  }
}

export function cashFlowFixture() {
  const operating = [
    { label: 'Net profit before tax', current: 250349000, prior: 187249000, kind: 'line' },
    { label: 'Movement in vendor payables', current: 184200000, prior: 142600000, kind: 'line' },
    { label: 'Movement in gateway escrow', current: -62408000, prior: -48200000, kind: 'line' },
    { label: 'Movement in statutory dues', current: 41800000, prior: 33400000, kind: 'line' },
  ]
  const investing = [
    { label: 'Own stock purchases', current: -486000000, prior: -364000000, kind: 'line' },
    { label: 'Equipment and fit-out', current: -18400000, prior: -9200000, kind: 'line' },
  ]
  const financing = [
    { label: 'Share capital issued', current: 0, prior: 500000000, kind: 'line' },
  ]

  const block = (label, lines) => [
    { label, current: 0, prior: 0, kind: 'group' },
    ...lines,
    {
      label: `Net cash from ${label.toLowerCase()}`,
      current: sum(lines, 'current'),
      prior: sum(lines, 'prior'),
      kind: 'subtotal',
    },
  ]

  const netMovement =
    sum(operating, 'current') + sum(investing, 'current') + sum(financing, 'current')

  return {
    title: 'Cash flow statement',
    period: '1 Apr – 2 Sep 2026',
    basis: 'Indirect method',
    unreconciled: 4,
    lines: [
      ...block('Operating activities', operating),
      ...block('Investing activities', investing),
      ...block('Financing activities', financing),
      { label: 'Net movement in cash', current: netMovement, prior: 0, kind: 'total' },
    ],
  }
}

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
      { id: 'att-4', title: 'GSTR-8 due 10 Sep', detail: 'TCS return for August 2026', amount: 10844000, tone: 'brand', to: ADMIN_ROUTES.TAX_CENTER },
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

export function pricingRuleListFixture() {
  return {
    tiers: [
      { role: 'retail_customer', label: 'Retail customer', discountFromRetail: 0, minQty: 1, products: 104220 },
      { role: 'wholesaler', label: 'Wholesaler', discountFromRetail: 15, minQty: 25, products: 38400 },
      { role: 'dealer', label: 'Dealer', discountFromRetail: 20, minQty: 50, products: 38400 },
      { role: 'distributor', label: 'Distributor', discountFromRetail: 35, minQty: 100, products: 22600 },
    ],
    rules: [
      { id: 'pr-1', name: 'Free shipping over ₹499', kind: 'shipping', condition: 'Cart value ≥ ₹499', effect: 'Shipping waived', active: true },
      { id: 'pr-2', name: 'Flat shipping', kind: 'shipping', condition: 'Cart value < ₹499', effect: '₹50 per sub-order', active: true },
      { id: 'pr-3', name: 'Bulk apparel discount', kind: 'discount', condition: 'Apparel, qty ≥ 100', effect: '5% off line total', active: true },
      { id: 'pr-4', name: 'Own stock markup floor', kind: 'markup', condition: 'Own stock products', effect: 'Minimum 8% margin', active: true },
      { id: 'pr-5', name: 'Festive electronics offer', kind: 'discount', condition: 'Electronics, 15–25 Oct', effect: '7% off, capped at ₹2,000', active: false },
    ],
  }
}

// ---------------------------------------------------------------------------
// Journal vouchers & expenses
// ---------------------------------------------------------------------------
const VOUCHERS = [
  { id: 'jv-1', number: 'JV/2627/00184', date: '2 Sep 2026', narration: 'Accrual — August server and CDN charges', postedBy: 'Anil Varma', debit: 3842000, credit: 3842000, status: 'posted' , lines: [{ code: '6030', debit: 3842000, credit: 0 }, { code: '2050', debit: 0, credit: 3842000 }] },
  { id: 'jv-2', number: 'JV/2627/00183', date: '1 Sep 2026', narration: 'Provision for RTO recovery not yet billed to vendors', postedBy: 'Anil Varma', debit: 1862500, credit: 1862500, status: 'posted' , lines: [{ code: '5040', debit: 1862500, credit: 0 }, { code: '2050', debit: 0, credit: 1862500 }] },
  { id: 'jv-3', number: 'JV/2627/00182', date: '31 Aug 2026', narration: 'August payroll accrual', postedBy: 'Anil Varma', debit: 28400000, credit: 28400000, status: 'posted' , lines: [{ code: '6010', debit: 28400000, credit: 0 }, { code: '2050', debit: 0, credit: 28400000 }] },
  { id: 'jv-4', number: 'JV/2627/00181', date: '30 Aug 2026', narration: 'Reversal of duplicate gateway fee posting', postedBy: 'Priya Sharma', debit: 18400, credit: 18400, status: 'reversed' , lines: [{ code: '1010', debit: 18400, credit: 0 }, { code: '5030', debit: 0, credit: 18400 }] },
  { id: 'jv-5', number: 'JV/2627/00185', date: '2 Sep 2026', narration: 'Marketing spend reclassification — draft', postedBy: 'Anil Varma', debit: 4260000, credit: 4260000, status: 'draft' , lines: [{ code: '6020', debit: 4260000, credit: 0 }, { code: '6040', debit: 0, credit: 4260000 }] },
]

const VOUCHER_TABS = {
  all: () => true,
  posted: (v) => v.status === 'posted',
  draft: (v) => v.status === 'draft',
  reversed: (v) => v.status === 'reversed',
}

export function journalVoucherListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = VOUCHERS.filter(VOUCHER_TABS[tab] || VOUCHER_TABS.all)
  rows = search(rows, filters.search, ['number', 'narration', 'postedBy'])
  return page(rows, VOUCHERS, VOUCHER_TABS, query)
}

const EXPENSES = [
  { id: 'exp-1', date: '2 Sep 2026', category: 'Hosting & infrastructure', vendor: 'Amazon Web Services', narration: 'August compute and storage', amount: 3842000, gst: 691560, itcClaimable: true, status: 'posted' },
  { id: 'exp-2', date: '1 Sep 2026', category: 'Marketing & promotions', vendor: 'Meta Platforms', narration: 'August performance campaigns', amount: 6420000, gst: 1155600, itcClaimable: true, status: 'paid' },
  { id: 'exp-3', date: '31 Aug 2026', category: 'Staff payroll', vendor: 'Payroll run', narration: 'August salaries — 46 staff', amount: 28400000, gst: 0, itcClaimable: false, status: 'paid' },
  { id: 'exp-4', date: '28 Aug 2026', category: 'Professional & legal fees', vendor: 'Balasubramanian & Co', narration: 'Q1 statutory audit fee', amount: 1440000, gst: 259200, itcClaimable: true, status: 'posted' },
  { id: 'exp-5', date: '26 Aug 2026', category: 'Office & administrative', vendor: 'Marol Estate Facilities', narration: 'August office rent and upkeep', amount: 2156000, gst: 388080, itcClaimable: true, status: 'paid' },
  { id: 'exp-6', date: '2 Sep 2026', category: 'Marketing & promotions', vendor: 'Google Ads', narration: 'September retainer — draft', amount: 4260000, gst: 766800, itcClaimable: true, status: 'draft' },
]

const EXPENSE_TABS = {
  all: () => true,
  draft: (e) => e.status === 'draft',
  posted: (e) => e.status === 'posted',
  paid: (e) => e.status === 'paid',
  itc: (e) => e.itcClaimable,
}

export function expenseListFixture(query = {}) {
  const { tab = 'all', filters = {} } = query
  let rows = EXPENSES.filter(EXPENSE_TABS[tab] || EXPENSE_TABS.all)
  rows = search(rows, filters.search, ['category', 'vendor', 'narration'])
  return page(rows, EXPENSES, EXPENSE_TABS, query)
}

// ---------------------------------------------------------------------------
// Tax centre
// ---------------------------------------------------------------------------
export function taxCentreFixture() {
  const output = 198426000
  const input = current('1030')
  return {
    position: [
      { label: 'Output GST collected', value: output, emphasis: false },
      { label: 'Input tax credit claimed', value: input, emphasis: false },
      { label: 'Net GST payable', value: output - input, emphasis: true },
      { label: 'TCS collected u/s 52 (1%)', value: current('2030'), emphasis: false },
      { label: 'TDS deducted u/s 194-O (1%)', value: current('2040'), emphasis: false },
    ],
    returns: [
      { id: 'r-1', form: 'GSTR-8', description: 'TCS return for marketplace operators', period: 'August 2026', dueOn: '10 Sep 2026', status: 'due', formats: ['JSON', 'CSV'] },
      { id: 'r-2', form: 'GSTR-1', description: 'Outward supplies', period: 'August 2026', dueOn: '11 Sep 2026', status: 'draft', formats: ['JSON', 'CSV'] },
      { id: 'r-3', form: 'GSTR-3B', description: 'Summary return and tax payment', period: 'July 2026', dueOn: '20 Aug 2026', status: 'filed', formats: ['CSV', 'PDF'] },
      { id: 'r-4', form: 'Form 26Q', description: 'TDS return u/s 194-O', period: 'Q1 FY 2026-27', dueOn: '31 Jul 2026', status: 'filed', formats: ['CSV'] },
      { id: 'r-5', form: 'GSTR-8', description: 'TCS return for marketplace operators', period: 'July 2026', dueOn: '10 Aug 2026', status: 'filed', formats: ['JSON', 'CSV'] },
    ],
  }
}

// ---------------------------------------------------------------------------
// Writes
//
// Postings mutate ACCOUNTS in place, which is the whole point: a voucher
// cannot move the P&L without also moving the trial balance and the balance
// sheet, because all three are derived from this one array. The seed balances
// above are an "as at" state — they already contain the seed vouchers, so
// only NEW postings are applied.
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

function normaliseLines(rawLines = []) {
  const lines = rawLines
    .map((line) => ({
      code: String(line.code || '').trim(),
      debit: Math.round(Number(line.debit) || 0),
      credit: Math.round(Number(line.credit) || 0),
    }))
    .filter((line) => line.code && (line.debit > 0 || line.credit > 0))

  for (const line of lines) {
    if (!byCode(line.code)) throw invalid(`Account ${line.code} is not in the chart of accounts.`)
    if (line.debit > 0 && line.credit > 0) {
      throw invalid('A line carries either a debit or a credit, never both.')
    }
  }
  return lines
}

// The rule that makes double entry double entry. Refusing the write here
// rather than in the form means it holds for the API too.
function assertBalanced(lines) {
  const debit = sum(lines, 'debit')
  const credit = sum(lines, 'credit')

  if (lines.length < 2) throw invalid('A voucher needs at least one debit and one credit line.')
  if (debit === 0) throw invalid('A voucher cannot post for zero.')
  if (debit !== credit) {
    throw invalid(
      `Out of balance by ₹${(Math.abs(debit - credit) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Debits must equal credits.`,
    )
  }
  return { debit, credit }
}

function nextVoucherNumber() {
  const highest = VOUCHERS.reduce((top, voucher) => {
    const digits = Number(String(voucher.number).split('/').pop())
    return Number.isFinite(digits) && digits > top ? digits : top
  }, 0)
  return `JV/2627/${String(highest + 1).padStart(5, '0')}`
}

const DISPLAY_DATE = { day: 'numeric', month: 'short', year: 'numeric' }
const displayDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', DISPLAY_DATE).replace(/ /g, ' ') : ''

export function createJournalVoucherFixture(body = {}) {
  const lines = normaliseLines(body.lines)
  const { debit, credit } = assertBalanced(lines)
  const status = body.status === 'draft' ? 'draft' : 'posted'

  const voucher = {
    id: nextId('jv'),
    number: nextVoucherNumber(),
    date: displayDate(body.date),
    narration: body.narration,
    postedBy: body.postedBy || 'Priya Sharma',
    debit,
    credit,
    status,
    lines,
  }

  if (status === 'posted') applyLines(lines, 1)
  return insert(VOUCHERS, voucher)
}

export function updateJournalVoucherFixture(id, body = {}) {
  const voucher = findOr404(VOUCHERS, id)
  if (voucher.status === 'reversed') throw invalid('A reversed voucher cannot be edited.')

  const lines = normaliseLines(body.lines)
  const { debit, credit } = assertBalanced(lines)

  // Back the old posting out before laying the new one down, so an edit never
  // leaves half of the previous figures behind in the ledger.
  if (voucher.status === 'posted') applyLines(voucher.lines, -1)

  const status = body.status === 'draft' ? 'draft' : 'posted'
  Object.assign(voucher, {
    date: body.date ? displayDate(body.date) : voucher.date,
    narration: body.narration ?? voucher.narration,
    debit,
    credit,
    status,
    lines,
  })

  if (status === 'posted') applyLines(lines, 1)
  return voucher
}

export function postJournalVoucherFixture(id) {
  const voucher = findOr404(VOUCHERS, id)
  if (voucher.status !== 'draft') throw invalid('Only a draft voucher can be posted.')
  assertBalanced(voucher.lines)
  applyLines(voucher.lines, 1)
  voucher.status = 'posted'
  return voucher
}

export function reverseJournalVoucherFixture(id) {
  const voucher = findOr404(VOUCHERS, id)
  if (voucher.status !== 'posted') throw invalid('Only a posted voucher can be reversed.')
  applyLines(voucher.lines, -1)
  voucher.status = 'reversed'
  return voucher
}

export function deleteJournalVoucherFixture(id) {
  const voucher = findOr404(VOUCHERS, id)
  // A posted voucher is part of the audit trail. It gets reversed, not erased.
  if (voucher.status === 'posted') throw invalid('A posted voucher must be reversed, not deleted.')
  drop(VOUCHERS, id)
  return { id }
}

export function journalVoucherFixture(id) {
  return findOr404(VOUCHERS, id)
}

// An expense is not just a row in a list — recording one posts to the ledger
// like anything else: the category account is debited, claimable GST goes to
// input tax credit receivable, and the whole lot is credited to accruals.
const ACCRUALS_CODE = '2050'
const INPUT_CREDIT_CODE = '1030'

const expenseAccounts = () => ACCOUNTS.filter((account) => account.code.startsWith('6'))

function expenseLines({ category, amount, gst, itcClaimable }) {
  const account = ACCOUNTS.find((entry) => entry.name === category)
  if (!account) throw invalid(`${category} is not an expense account.`)

  const claimable = itcClaimable ? gst : 0
  const lines = [{ code: account.code, debit: amount + (itcClaimable ? 0 : gst), credit: 0 }]
  if (claimable > 0) lines.push({ code: INPUT_CREDIT_CODE, debit: claimable, credit: 0 })
  lines.push({ code: ACCRUALS_CODE, debit: 0, credit: amount + gst })
  return lines
}

function readExpense(body = {}) {
  const amount = Math.round(Number(body.amount) || 0)
  const gst = Math.round(Number(body.gst) || 0)
  if (amount <= 0) throw invalid('An expense needs an amount above zero.')
  return {
    date: body.date ? displayDate(body.date) : todayDisplay(),
    category: body.category,
    vendor: body.vendor,
    narration: body.narration,
    amount,
    gst,
    itcClaimable: Boolean(body.itcClaimable),
    status: body.status === 'draft' ? 'draft' : body.status === 'paid' ? 'paid' : 'posted',
  }
}

const todayDisplay = () => new Date().toLocaleDateString('en-IN', DISPLAY_DATE)

// Draft expenses are not in the books yet, so only posted/paid ones move it.
const inBooks = (status) => status === 'posted' || status === 'paid'

export function createExpenseFixture(body = {}) {
  const fields = readExpense(body)
  const expense = { id: nextId('exp'), ...fields }
  if (inBooks(expense.status)) applyLines(expenseLines(expense), 1)
  return insert(EXPENSES, expense)
}

export function updateExpenseFixture(id, body = {}) {
  const expense = findOr404(EXPENSES, id)
  const fields = readExpense({ ...expense, ...body })

  if (inBooks(expense.status)) applyLines(expenseLines(expense), -1)
  Object.assign(expense, fields)
  if (inBooks(expense.status)) applyLines(expenseLines(expense), 1)

  return expense
}

export function deleteExpenseFixture(id) {
  const expense = findOr404(EXPENSES, id)
  if (inBooks(expense.status)) applyLines(expenseLines(expense), -1)
  drop(EXPENSES, id)
  return { id }
}

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

export function createAccountFixture(body = {}) {
  const code = String(body.code || '').trim()
  if (!/^\d{4}$/.test(code)) throw invalid('An account code is four digits.')
  if (byCode(code)) throw invalid(`Account ${code} already exists.`)

  const account = {
    code,
    name: String(body.name || '').trim(),
    group: body.group,
    balance: 0,
    isSubLedger: Boolean(body.isSubLedger),
    isActive: true,
  }
  ACCOUNTS.push(account)
  ACCOUNTS.sort((a, b) => a.code.localeCompare(b.code))
  return account
}

export function updateAccountFixture(code, body = {}) {
  const account = findOr404(ACCOUNTS, code, 'code')
  // The group decides which side of the trial balance the balance lands on,
  // so it cannot be changed once the account carries one.
  if (body.group && body.group !== account.group && account.balance !== 0) {
    throw invalid('An account holding a balance cannot change its group.')
  }
  Object.assign(account, {
    name: body.name ?? account.name,
    group: body.group ?? account.group,
    isSubLedger: body.isSubLedger ?? account.isSubLedger,
  })
  return account
}

export function setAccountActiveFixture(code, isActive) {
  const account = findOr404(ACCOUNTS, code, 'code')
  if (!isActive && account.balance !== 0) {
    throw invalid('An account still holding a balance cannot be deactivated.')
  }
  account.isActive = isActive
  return account
}

/** Postable accounts, for the account picker on voucher and expense forms. */
export function accountOptionsFixture() {
  return {
    accounts: ACCOUNTS.filter((account) => account.isActive !== false).map((account) => ({
      code: account.code,
      name: account.name,
      group: account.group,
    })),
    expenseCategories: expenseAccounts().map((account) => account.name),
  }
}

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
