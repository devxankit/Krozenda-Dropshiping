// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as service from '../services/accountingService'
import { useListController } from './useListController'
import { useAdminMutation } from './useAdminMutation'

// Every accounting write invalidates the whole accounting tree rather than one
// list. That is not laziness: approving a refund moves the refund list, the
// seller's ledger, the transactions list, the settlement that line belongs to
// AND the overview cards at once. Refreshing only the list the action was
// taken from would leave the operator looking at stale money.
const ACCOUNTING = [['admin', 'accounting']]

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

/**
 * The range picker shared by the Overview and the report runner.
 *
 * A custom range is only sent once BOTH ends are filled in — a half-finished
 * range would otherwise fire a request the API correctly rejects, and the
 * screen would flash an error while the operator is still typing.
 */
export function useAccountingRange(initial = 'last_30_days') {
  const [range, setRange] = useState(initial)
  const [custom, setCustom] = useState({ from: '', to: '' })

  const params = useMemo(() => {
    if (range === 'all') return {}
    if (range === 'custom') {
      if (!custom.from || !custom.to) return {}
      return { range: 'custom', from: custom.from, to: custom.to }
    }
    return { range }
  }, [range, custom])

  const isIncomplete = range === 'custom' && (!custom.from || !custom.to)

  return { range, setRange, custom, setCustom, params, isIncomplete }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function useAccountingOverviewController() {
  const range = useAccountingRange()
  const query = useResource(['admin', 'accounting', 'overview', range.params], () =>
    service.fetchAccountingOverview(range.params),
  )
  return { ...query, range }
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const useAccountingTransactionListController = () =>
  useListController({
    queryKey: ['admin', 'accounting', 'transactions'],
    queryFn: service.fetchAccountingTransactions,
  })

export const useAccountingTransactionController = (transactionId) =>
  useResource(
    ['admin', 'accounting', 'transactions', transactionId],
    () => service.fetchAccountingTransaction(transactionId),
    Boolean(transactionId),
  )

export const usePendingCodController = () =>
  useListController({
    queryKey: ['admin', 'accounting', 'cod-pending'],
    queryFn: service.fetchPendingCod,
  })

export const useCodRemittanceController = ({ onDone } = {}) =>
  useAdminMutation({
    mutationFn: service.recordCodRemittance,
    invalidate: ACCOUNTING,
    success: (result) => `COD collected for ${result.orderNumber}`,
    describe: (result) =>
      `${result.transactionsPosted} ledger entr${result.transactionsPosted === 1 ? 'y' : 'ies'} posted.`,
    onDone,
  })

// ---------------------------------------------------------------------------
// Seller ledger
// ---------------------------------------------------------------------------

export const useSellerLedgerListController = () =>
  useListController({
    queryKey: ['admin', 'accounting', 'seller-ledger'],
    queryFn: service.fetchSellerLedgers,
  })

/**
 * One seller's statement. The filters live here rather than in
 * useListController because this screen is a detail view with a table inside
 * it, not a list screen — its summary tiles and its table read the same
 * response.
 */
export function useSellerLedgerController(sellerId) {
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)

  const params = useMemo(() => ({ ...filters, page, rowsPerPage: 25 }), [filters, page])

  const query = useResource(
    ['admin', 'accounting', 'seller-ledger', sellerId, params],
    () => service.fetchSellerLedger(sellerId, params),
    Boolean(sellerId),
  )

  const changeFilters = useCallback((next) => {
    setFilters(next)
    setPage(1)
  }, [])

  return { ...query, filters, changeFilters, page, setPage }
}

export const useAdjustmentController = ({ onDone } = {}) =>
  useAdminMutation({
    mutationFn: service.createAdjustment,
    invalidate: ACCOUNTING,
    success: (txn) => `${txn.transactionId} posted`,
    describe: (txn) => txn.description,
    onDone,
  })

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export const useCommissionRuleListController = () =>
  useListController({
    queryKey: ['admin', 'accounting', 'commissions'],
    queryFn: service.fetchCommissionRules,
  })

export const useCommissionOptionsController = (productSearch = '') =>
  useResource(['admin', 'accounting', 'commission-options', productSearch], () =>
    service.fetchCommissionOptions(productSearch),
  )

export function useCommissionRuleWriteController({ onSaved } = {}) {
  const create = useAdminMutation({
    mutationFn: service.createCommissionRule,
    invalidate: ACCOUNTING,
    success: (rule) => `${rule.name} created`,
    describe: (rule) =>
      `${rule.scopeLabel} · ${rule.type === 'PERCENTAGE' ? `${rule.value}%` : `₹${rule.value}`}`,
    onDone: onSaved,
  })

  const update = useAdminMutation({
    mutationFn: service.updateCommissionRule,
    invalidate: ACCOUNTING,
    success: (rule) => `${rule.name} updated`,
    // Says the thing an operator will want confirmed after editing a live
    // commission rule.
    describe: () => 'Orders already charged keep the rate they were charged.',
    onDone: onSaved,
  })

  const setStatus = useAdminMutation({
    mutationFn: service.setCommissionRuleStatus,
    invalidate: ACCOUNTING,
    success: (rule) => `${rule.name} ${rule.isActive ? 'activated' : 'retired'}`,
  })

  return { create, update, setStatus }
}

export const useAccountingConfigController = () =>
  useResource(['admin', 'accounting', 'config'], service.fetchAccountingConfig)

export const useAccountingConfigWriteController = ({ onDone } = {}) =>
  useAdminMutation({
    mutationFn: service.updateAccountingConfig,
    invalidate: ACCOUNTING,
    success: 'Accounting policy updated',
    describe: () => 'It applies to transactions posted from now on.',
    onDone,
  })

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export const useSettlementListController = () =>
  useListController({
    queryKey: ['admin', 'accounting', 'settlements'],
    queryFn: service.fetchSettlements,
  })

export const useSettlementController = (settlementId) =>
  useResource(
    ['admin', 'accounting', 'settlements', settlementId],
    () => service.fetchSettlement(settlementId),
    Boolean(settlementId),
  )

export function useSettlementWriteController({ onDone } = {}) {
  const generate = useAdminMutation({
    mutationFn: service.generateSettlements,
    invalidate: ACCOUNTING,
    success: (result) =>
      result.generated === 0 ? 'Nothing is eligible yet' : `${result.generated} settlement(s) generated`,
    describe: (result) =>
      result.generated === 0
        ? 'Delivered lines become eligible once their hold window has passed.'
        : undefined,
    onDone,
  })

  const hold = useAdminMutation({
    mutationFn: service.holdSettlement,
    invalidate: ACCOUNTING,
    success: (settlement) => `${settlement.settlementId} put on hold`,
    onDone,
  })

  const release = useAdminMutation({
    mutationFn: service.releaseSettlement,
    invalidate: ACCOUNTING,
    success: (settlement) => `${settlement.settlementId} released`,
    onDone,
  })

  // Result shape varies — see accountingService.releaseSettlementTransfer.
  // A `payoutId` means a Razorpay transfer is actually now in flight; no
  // `payoutId` means the backend reports nothing was actionable and the
  // `message` it sent back already explains why (already released, on hold,
  // manual mode, no payment to transfer against, …).
  const releaseTransfer = useAdminMutation({
    mutationFn: service.releaseSettlementTransfer,
    invalidate: ACCOUNTING,
    success: (result) => (result?.payoutId ? `${result.payoutId} release requested` : 'Nothing to release yet'),
    describe: (result) =>
      result?.payoutId
        ? 'Razorpay will settle the transfer to the seller once it confirms.'
        : result?.outcome || undefined,
    onDone,
  })

  return { generate, hold, release, releaseTransfer }
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export const usePayoutListController = () =>
  useListController({ queryKey: ['admin', 'accounting', 'payouts'], queryFn: service.fetchPayouts })

export const usePayoutController = (payoutId) =>
  useResource(
    ['admin', 'accounting', 'payouts', payoutId],
    () => service.fetchPayout(payoutId),
    Boolean(payoutId),
  )

export function usePayoutWriteController({ onDone } = {}) {
  const create = useAdminMutation({
    mutationFn: service.createPayout,
    invalidate: ACCOUNTING,
    success: (payout) => `${payout.payoutId} initiated`,
    describe: (payout) => `To ${payout.bankAccountMasked || payout.seller}`,
    onDone,
  })

  const setStatus = useAdminMutation({
    mutationFn: service.updatePayoutStatus,
    invalidate: ACCOUNTING,
    success: (payout) => `${payout.payoutId} marked ${payout.status.toLowerCase()}`,
    onDone,
  })

  return { create, setStatus }
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const useAccountingRefundListController = () =>
  useListController({ queryKey: ['admin', 'accounting', 'refunds'], queryFn: service.fetchAccountingRefunds })

export const useAccountingRefundController = (refundId) =>
  useResource(
    ['admin', 'accounting', 'refunds', refundId],
    () => service.fetchAccountingRefund(refundId),
    Boolean(refundId),
  )

export function useAccountingRefundWriteController({ onDone } = {}) {
  const approve = useAdminMutation({
    mutationFn: service.approveRefund,
    invalidate: ACCOUNTING,
    success: (refund) => `${refund.refundId} approved`,
    describe: () => 'The reversal has been posted to the seller ledger.',
    onDone,
  })

  const reject = useAdminMutation({
    mutationFn: service.rejectRefund,
    invalidate: ACCOUNTING,
    success: (refund) => `${refund.refundId} declined`,
    onDone,
  })

  return { approve, reject }
}

// ---------------------------------------------------------------------------
// Reports & audit
// ---------------------------------------------------------------------------

export const useReportCatalogueController = () =>
  useResource(['admin', 'accounting', 'reports'], service.fetchReportCatalogue)

export function useAccountingReportController(reportKey) {
  const range = useAccountingRange()
  const [filters, setFilters] = useState({})

  const params = useMemo(() => ({ ...range.params, ...filters }), [range.params, filters])

  const query = useResource(
    ['admin', 'accounting', 'reports', reportKey, params],
    () => service.runAccountingReport(reportKey, params),
    Boolean(reportKey),
  )

  return { ...query, range, filters, setFilters }
}

export const useAccountingAuditLogController = () =>
  useListController({ queryKey: ['admin', 'accounting', 'audit-log'], queryFn: service.fetchAccountingAuditLog })
