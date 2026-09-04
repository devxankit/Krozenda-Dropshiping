// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/financeService'
import { useListController } from './useListController'
import { useAdminMutation } from './useAdminMutation'

export const useTransactionListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'transactions'], queryFn: service.fetchTransactions })

export const useRefundListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'refunds'], queryFn: service.fetchRefunds })

export const useSettlementListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'settlements'], queryFn: service.fetchSettlements })

export const useVendorLedgerListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'ledgers'], queryFn: service.fetchVendorLedgers })

export const useJournalVoucherListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'vouchers'], queryFn: service.fetchJournalVouchers })

export const useExpenseListController = () =>
  useListController({ queryKey: ['admin', 'finance', 'expenses'], queryFn: service.fetchExpenses })

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useFinanceOverviewController = () =>
  useResource(['admin', 'finance', 'overview'], service.fetchFinanceOverview)

export const useCommissionRulesController = () =>
  useResource(['admin', 'finance', 'commission-rules'], service.fetchCommissionRules)

export const usePricingRulesController = () =>
  useResource(['admin', 'finance', 'pricing-rules'], service.fetchPricingRules)

export const useChartOfAccountsController = () =>
  useResource(['admin', 'finance', 'coa'], service.fetchChartOfAccounts)

export const useTrialBalanceController = () =>
  useResource(['admin', 'finance', 'trial-balance'], service.fetchTrialBalance)

export const useTaxCentreController = () =>
  useResource(['admin', 'finance', 'tax'], service.fetchTaxCentre)

export const useStatementController = (kind) =>
  useResource(['admin', 'finance', 'statement', kind], () => service.fetchStatement(kind))

export const useSettlementBatchController = (batchId) =>
  useResource(
    ['admin', 'finance', 'settlements', batchId],
    () => service.fetchSettlementBatch(batchId),
    Boolean(batchId),
  )

export const useVendorStatementController = (vendorId) =>
  useResource(
    ['admin', 'finance', 'ledgers', vendorId],
    () => service.fetchVendorStatement(vendorId),
    Boolean(vendorId),
  )

export const useAccountOptionsController = () =>
  useResource(['admin', 'finance', 'account-options'], service.fetchAccountOptions)

// Every accounting write invalidates the whole finance tree rather than one
// list. That is not laziness: a posting moves the vouchers list, the trial
// balance, the P&L and the balance sheet at once, so refreshing only the list
// it was made from would leave the statements showing stale figures.
const LEDGER = [['admin', 'finance']]

export const useJournalVoucherWriteController = ({ onSaved } = {}) => {
  const create = useAdminMutation({
    mutationFn: service.createJournalVoucher,
    invalidate: LEDGER,
    success: (voucher) => `${voucher.number} ${voucher.status === 'draft' ? 'saved as draft' : 'posted'}`,
    describe: (voucher) => voucher.narration,
    onDone: onSaved,
  })

  const update = useAdminMutation({
    mutationFn: service.updateJournalVoucher,
    invalidate: LEDGER,
    success: (voucher) => `${voucher.number} updated`,
    onDone: onSaved,
  })

  const post = useAdminMutation({
    mutationFn: service.postJournalVoucher,
    invalidate: LEDGER,
    success: (voucher) => `${voucher.number} posted to the ledger`,
  })

  const reverse = useAdminMutation({
    mutationFn: service.reverseJournalVoucher,
    invalidate: LEDGER,
    success: (voucher) => `${voucher.number} reversed`,
    describe: () => 'The original entry stays in the audit trail.',
  })

  const remove = useAdminMutation({
    mutationFn: service.deleteJournalVoucher,
    invalidate: LEDGER,
    success: 'Draft voucher deleted',
  })

  return { create, update, post, reverse, remove }
}

export const useExpenseWriteController = ({ onSaved } = {}) => {
  const create = useAdminMutation({
    mutationFn: service.createExpense,
    invalidate: LEDGER,
    success: 'Expense recorded',
    describe: (expense) => `${expense.category} — ${expense.vendor}`,
    onDone: onSaved,
  })

  const update = useAdminMutation({
    mutationFn: service.updateExpense,
    invalidate: LEDGER,
    success: 'Expense updated',
    onDone: onSaved,
  })

  const remove = useAdminMutation({
    mutationFn: service.deleteExpense,
    invalidate: LEDGER,
    success: 'Expense deleted',
    describe: () => 'Its ledger postings were backed out.',
  })

  return { create, update, remove }
}

export const useAccountWriteController = ({ onSaved } = {}) => {
  const create = useAdminMutation({
    mutationFn: service.createAccount,
    invalidate: LEDGER,
    success: (account) => `Account ${account.code} created`,
    describe: (account) => account.name,
    onDone: onSaved,
  })

  const update = useAdminMutation({
    mutationFn: service.updateAccount,
    invalidate: LEDGER,
    success: (account) => `Account ${account.code} updated`,
    onDone: onSaved,
  })

  const setActive = useAdminMutation({
    mutationFn: service.setAccountActive,
    invalidate: LEDGER,
    success: (account) => `${account.code} ${account.isActive ? 'reactivated' : 'deactivated'}`,
  })

  return { create, update, setActive }
}

// Maker–checker lives in two places on purpose: PAYOUT_APPROVE decides who
// sees the button, and the two-factor code decides whether the release goes
// through. Neither alone is the control.
export const useSettlementWriteController = ({ onDone } = {}) => {
  const approve = useAdminMutation({
    mutationFn: service.approveSettlement,
    invalidate: LEDGER,
    success: (batch) => `Batch ${batch.id} released`,
    describe: (batch) => `UTR ${batch.utr} · paid to ${batch.vendor}`,
    onDone,
  })

  const reject = useAdminMutation({
    mutationFn: service.rejectSettlement,
    invalidate: LEDGER,
    success: (batch) => `Batch ${batch.id} rejected`,
    describe: () => 'It goes back to the hold queue. No money moved.',
    onDone,
  })

  const retry = useAdminMutation({
    mutationFn: service.retrySettlement,
    invalidate: LEDGER,
    success: (batch) => `Batch ${batch.id} queued for approval again`,
  })

  return { approve, reject, retry }
}

export const useRefundWriteController = ({ onDone } = {}) => {
  const process = useAdminMutation({
    mutationFn: service.processRefund,
    invalidate: LEDGER,
    success: (refund) => `Refund ${refund.reference} paid`,
    describe: () => 'The vendor transfer was reversed with it.',
    onDone,
  })

  const reject = useAdminMutation({
    mutationFn: service.rejectRefund,
    invalidate: LEDGER,
    success: (refund) => `Refund ${refund.reference} declined`,
    onDone,
  })

  return { process, reject }
}

export const useTransactionWriteController = () => {
  const reconcile = useAdminMutation({
    mutationFn: service.reconcileTransaction,
    invalidate: LEDGER,
    success: (row) => `${row.reference} marked ${row.reconciled ? 'reconciled' : 'unreconciled'}`,
  })

  const reconcileMany = useAdminMutation({
    mutationFn: service.bulkReconcileTransactions,
    invalidate: LEDGER,
    success: (result) => `${result.ids.length} payments reconciled`,
  })

  return { reconcile, reconcileMany }
}

export const useVendorLedgerWriteController = ({ onDone } = {}) => {
  const adjust = useAdminMutation({
    mutationFn: service.adjustVendorLedger,
    invalidate: LEDGER,
    success: (ledger) => `${ledger.vendor} adjusted`,
    describe: (ledger) => `Closing balance is now ₹${(ledger.closing / 100).toLocaleString('en-IN')}`,
    onDone,
  })

  return { adjust }
}
