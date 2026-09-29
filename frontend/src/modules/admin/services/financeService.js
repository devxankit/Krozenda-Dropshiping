// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/finance'
import {
  commissionRuleListSchema,
  financeOverviewSchema,
  refundListSchema,
  settlementBatchDetailSchema,
  settlementListSchema,
  reconciledBatchSchema,
  refundSchema,
  settlementBatchSchema,
  transactionSchema,
  vendorLedgerSchema,
  transactionListSchema,
  vendorLedgerListSchema,
  vendorStatementSchema,
} from '../schemas/financeSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

// Practical marketplace finance (Transactions/Refunds/Settlements/Vendor
// Ledger/Commission Rules) is a real backend — see adminFinanceController.
const liveList = (path, fixture, schema) => (query) =>
  fetchResource({ path, params: params(query), fixture: () => fixture(query), schema, live: true })

export const fetchFinanceOverview = () =>
  fetchResource({
    path: '/admin/finance/overview',
    fixture: fixtures.financeOverviewFixture,
    schema: financeOverviewSchema,
    live: true,
  })

export const fetchTransactions = liveList(
  '/admin/finance/transactions',
  fixtures.transactionListFixture,
  transactionListSchema,
)
export const fetchRefunds = liveList('/admin/finance/refunds', fixtures.refundListFixture, refundListSchema)
export const fetchSettlements = liveList(
  '/admin/finance/settlements',
  fixtures.settlementListFixture,
  settlementListSchema,
)
export const fetchVendorLedgers = liveList(
  '/admin/finance/vendor-ledger',
  fixtures.vendorLedgerListFixture,
  vendorLedgerListSchema,
)

export const fetchSettlementBatch = (batchId) =>
  fetchResource({
    path: `/admin/finance/settlements/${batchId}`,
    fixture: () => fixtures.settlementBatchFixture(batchId),
    schema: settlementBatchDetailSchema,
    live: true,
  })

export const fetchVendorStatement = (vendorId) =>
  fetchResource({
    path: `/admin/finance/vendor-ledger/${vendorId}`,
    fixture: () => fixtures.vendorStatementFixture(vendorId),
    schema: vendorStatementSchema,
    live: true,
  })

export const fetchCommissionRules = () =>
  fetchResource({
    path: '/admin/finance/commission-rules',
    fixture: fixtures.commissionRuleListFixture,
    schema: commissionRuleListSchema,
    live: true,
  })

export const updateCommissionRule = ({ id, value }) =>
  mutateResource({
    method: 'patch',
    path: `/admin/finance/commission-rules/${id}`,
    body: { value },
    fixture: () => fixtures.commissionRuleListFixture().items.find((r) => r.id === id),
    schema: commissionRuleListSchema.shape.items.element,
    live: true,
  })

// --- money movement -------------------------------------------------------

export const approveSettlement = ({ id, twoFactorCode }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/approve`,
    body: { twoFactorCode },
    fixture: (payload) => fixtures.approveSettlementFixture(id, payload),
    schema: settlementBatchSchema,
    live: true,
  })

export const rejectSettlement = ({ id, reason }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/reject`,
    body: { reason },
    fixture: (payload) => fixtures.rejectSettlementFixture(id, payload),
    schema: settlementBatchSchema,
    live: true,
  })

export const retrySettlement = ({ id }) =>
  mutateResource({
    path: `/admin/finance/settlements/${id}/retry`,
    body: { id },
    fixture: () => fixtures.retrySettlementFixture(id),
    schema: settlementBatchSchema,
    live: true,
  })

export const processRefund = ({ id }) =>
  mutateResource({
    path: `/admin/finance/refunds/${id}/process`,
    body: { id },
    fixture: () => fixtures.processRefundFixture(id),
    schema: refundSchema,
    live: true,
  })

export const rejectRefund = ({ id, reason }) =>
  mutateResource({
    path: `/admin/finance/refunds/${id}/reject`,
    body: { reason },
    fixture: (payload) => fixtures.rejectRefundFixture(id, payload),
    schema: refundSchema,
    live: true,
  })

export const reconcileTransaction = ({ id, reconciled = true }) =>
  mutateResource({
    method: 'patch',
    path: `/admin/finance/transactions/${id}/reconcile`,
    body: { reconciled },
    fixture: () => fixtures.reconcileTransactionFixture(id, reconciled),
    schema: transactionSchema,
    live: true,
  })

export const bulkReconcileTransactions = ({ ids }) =>
  mutateResource({
    method: 'patch',
    path: '/admin/finance/transactions/reconcile',
    body: { ids },
    fixture: () => fixtures.bulkReconcileTransactionsFixture(ids),
    schema: reconciledBatchSchema,
    live: true,
  })

export const adjustVendorLedger = ({ vendorId, amount, reason }) =>
  mutateResource({
    path: `/admin/finance/ledgers/${vendorId}/adjust`,
    body: { amount, reason },
    fixture: (payload) => fixtures.adjustVendorLedgerFixture(vendorId, payload),
    schema: vendorLedgerSchema,
  })
