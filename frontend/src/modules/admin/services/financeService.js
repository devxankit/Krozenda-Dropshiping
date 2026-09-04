// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/finance'
import {
  accountOptionsSchema,
  accountSchema,
  chartOfAccountsSchema,
  commissionRuleListSchema,
  expenseListSchema,
  financeOverviewSchema,
  journalVoucherListSchema,
  pricingRuleListSchema,
  refundListSchema,
  settlementBatchDetailSchema,
  settlementListSchema,
  statementSchema,
  taxCentreSchema,
  deletedSchema,
  expenseSchema,
  reconciledBatchSchema,
  refundSchema,
  settlementBatchSchema,
  transactionSchema,
  vendorLedgerSchema,
  journalVoucherSchema,
  transactionListSchema,
  trialBalanceSchema,
  vendorLedgerListSchema,
  vendorStatementSchema,
} from '../schemas/financeSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

const list = (path, fixture, schema) => (query) =>
  fetchResource({ path, params: params(query), fixture: () => fixture(query), schema })

export const fetchFinanceOverview = () =>
  fetchResource({
    path: '/admin/finance/overview',
    fixture: fixtures.financeOverviewFixture,
    schema: financeOverviewSchema,
  })

export const fetchTransactions = list(
  '/admin/finance/transactions',
  fixtures.transactionListFixture,
  transactionListSchema,
)
export const fetchRefunds = list('/admin/finance/refunds', fixtures.refundListFixture, refundListSchema)
export const fetchSettlements = list(
  '/admin/finance/settlements',
  fixtures.settlementListFixture,
  settlementListSchema,
)
export const fetchVendorLedgers = list(
  '/admin/finance/vendor-ledger',
  fixtures.vendorLedgerListFixture,
  vendorLedgerListSchema,
)
export const fetchJournalVouchers = list(
  '/admin/finance/journal-vouchers',
  fixtures.journalVoucherListFixture,
  journalVoucherListSchema,
)
export const fetchExpenses = list('/admin/finance/expenses', fixtures.expenseListFixture, expenseListSchema)

export const fetchSettlementBatch = (batchId) =>
  fetchResource({
    path: `/admin/finance/settlements/${batchId}`,
    fixture: () => fixtures.settlementBatchFixture(batchId),
    schema: settlementBatchDetailSchema,
  })

export const fetchVendorStatement = (vendorId) =>
  fetchResource({
    path: `/admin/finance/vendor-ledger/${vendorId}`,
    fixture: () => fixtures.vendorStatementFixture(vendorId),
    schema: vendorStatementSchema,
  })

export const fetchCommissionRules = () =>
  fetchResource({
    path: '/admin/finance/commission-rules',
    fixture: fixtures.commissionRuleListFixture,
    schema: commissionRuleListSchema,
  })

export const fetchPricingRules = () =>
  fetchResource({
    path: '/admin/finance/pricing-rules',
    fixture: fixtures.pricingRuleListFixture,
    schema: pricingRuleListSchema,
  })

export const fetchChartOfAccounts = () =>
  fetchResource({
    path: '/admin/finance/chart-of-accounts',
    fixture: fixtures.chartOfAccountsFixture,
    schema: chartOfAccountsSchema,
  })

export const fetchTrialBalance = () =>
  fetchResource({
    path: '/admin/finance/trial-balance',
    fixture: fixtures.trialBalanceFixture,
    schema: trialBalanceSchema,
  })

export const fetchTaxCentre = () =>
  fetchResource({
    path: '/admin/finance/tax-center',
    fixture: fixtures.taxCentreFixture,
    schema: taxCentreSchema,
  })

// The three comparative statements share one shape, so they share one call.
const STATEMENTS = {
  pnl: fixtures.profitAndLossFixture,
  'balance-sheet': fixtures.balanceSheetFixture,
  'cash-flow': fixtures.cashFlowFixture,
}

export const fetchStatement = (kind) =>
  fetchResource({
    path: `/admin/finance/${kind}`,
    fixture: STATEMENTS[kind],
    schema: statementSchema,
  })

// ---------------------------------------------------------------------------
// Writes. Same shape as the reads: one path for the API, one fixture standing
// in for it, and the SAME schema over both.
// ---------------------------------------------------------------------------

export const fetchAccountOptions = () =>
  fetchResource({
    path: '/admin/finance/accounts/options',
    fixture: fixtures.accountOptionsFixture,
    schema: accountOptionsSchema,
  })

export const createJournalVoucher = (body) =>
  mutateResource({
    path: '/admin/finance/vouchers',
    body,
    fixture: fixtures.createJournalVoucherFixture,
    schema: journalVoucherSchema,
  })

export const updateJournalVoucher = ({ id, ...body }) =>
  mutateResource({
    method: 'put',
    path: `/admin/finance/vouchers/${id}`,
    body,
    fixture: (payload) => fixtures.updateJournalVoucherFixture(id, payload),
    schema: journalVoucherSchema,
  })

export const postJournalVoucher = ({ id }) =>
  mutateResource({
    path: `/admin/finance/vouchers/${id}/post`,
    body: { id },
    fixture: () => fixtures.postJournalVoucherFixture(id),
    schema: journalVoucherSchema,
  })

export const reverseJournalVoucher = ({ id }) =>
  mutateResource({
    path: `/admin/finance/vouchers/${id}/reverse`,
    body: { id },
    fixture: () => fixtures.reverseJournalVoucherFixture(id),
    schema: journalVoucherSchema,
  })

export const deleteJournalVoucher = ({ id }) =>
  mutateResource({
    method: 'delete',
    path: `/admin/finance/vouchers/${id}`,
    fixture: () => fixtures.deleteJournalVoucherFixture(id),
    schema: deletedSchema,
  })

export const createExpense = (body) =>
  mutateResource({
    path: '/admin/finance/expenses',
    body,
    fixture: fixtures.createExpenseFixture,
    schema: expenseSchema,
  })

export const updateExpense = ({ id, ...body }) =>
  mutateResource({
    method: 'put',
    path: `/admin/finance/expenses/${id}`,
    body,
    fixture: (payload) => fixtures.updateExpenseFixture(id, payload),
    schema: expenseSchema,
  })

export const deleteExpense = ({ id }) =>
  mutateResource({
    method: 'delete',
    path: `/admin/finance/expenses/${id}`,
    fixture: () => fixtures.deleteExpenseFixture(id),
    schema: deletedSchema,
  })

export const createAccount = (body) =>
  mutateResource({
    path: '/admin/finance/accounts',
    body,
    fixture: fixtures.createAccountFixture,
    schema: accountSchema,
  })

export const updateAccount = ({ code, ...body }) =>
  mutateResource({
    method: 'put',
    path: `/admin/finance/accounts/${code}`,
    body,
    fixture: (payload) => fixtures.updateAccountFixture(code, payload),
    schema: accountSchema,
  })

export const setAccountActive = ({ code, isActive }) =>
  mutateResource({
    method: 'put',
    path: `/admin/finance/accounts/${code}/active`,
    body: { isActive },
    fixture: () => fixtures.setAccountActiveFixture(code, isActive),
    schema: accountSchema,
  })

// --- money movement -------------------------------------------------------

export const approveSettlement = ({ id, twoFactorCode }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/approve`,
    body: { twoFactorCode },
    fixture: (payload) => fixtures.approveSettlementFixture(id, payload),
    schema: settlementBatchSchema,
  })

export const rejectSettlement = ({ id, reason }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/reject`,
    body: { reason },
    fixture: (payload) => fixtures.rejectSettlementFixture(id, payload),
    schema: settlementBatchSchema,
  })

export const retrySettlement = ({ id }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/retry`,
    body: { id },
    fixture: () => fixtures.retrySettlementFixture(id),
    schema: settlementBatchSchema,
  })

export const processRefund = ({ id }) =>
  mutateResource({
    path: `/admin/finance/refunds/${id}/process`,
    body: { id },
    fixture: () => fixtures.processRefundFixture(id),
    schema: refundSchema,
  })

export const rejectRefund = ({ id, reason }) =>
  mutateResource({
    path: `/admin/finance/refunds/${id}/reject`,
    body: { reason },
    fixture: (payload) => fixtures.rejectRefundFixture(id, payload),
    schema: refundSchema,
  })

export const reconcileTransaction = ({ id, reconciled = true }) =>
  mutateResource({
    path: `/admin/finance/transactions/${id}/reconcile`,
    body: { reconciled },
    fixture: () => fixtures.reconcileTransactionFixture(id, reconciled),
    schema: transactionSchema,
  })

export const bulkReconcileTransactions = ({ ids }) =>
  mutateResource({
    path: '/admin/finance/transactions/reconcile',
    body: { ids },
    fixture: () => fixtures.bulkReconcileTransactionsFixture(ids),
    schema: reconciledBatchSchema,
  })

export const adjustVendorLedger = ({ vendorId, amount, reason }) =>
  mutateResource({
    path: `/admin/finance/ledgers/${vendorId}/adjust`,
    body: { amount, reason },
    fixture: (payload) => fixtures.adjustVendorLedgerFixture(vendorId, payload),
    schema: vendorLedgerSchema,
  })
