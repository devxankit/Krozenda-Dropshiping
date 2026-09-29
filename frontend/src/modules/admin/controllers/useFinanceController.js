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

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useFinanceOverviewController = () =>
  useResource(['admin', 'finance', 'overview'], service.fetchFinanceOverview)

export const useCommissionRulesController = () =>
  useResource(['admin', 'finance', 'commission-rules'], service.fetchCommissionRules)

export const useCommissionRuleWriteController = () =>
  useAdminMutation({
    mutationFn: service.updateCommissionRule,
    invalidate: [['admin', 'finance', 'commission-rules']],
    success: (rule) => `${rule.target} commission set to ${rule.value}%`,
  })

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

// Every finance write invalidates the whole finance tree rather than one
// list: a settlement or refund moves the overview, the ledgers and the lists
// at once.
const LEDGER = [['admin', 'finance']]

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
