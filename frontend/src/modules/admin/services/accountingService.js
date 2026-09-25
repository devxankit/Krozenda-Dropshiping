// Layer rule: services/ is the ONLY place that imports the axios instance.
//
// Unlike the other modules, Accounting has NO fixtures and never consults
// VITE_USE_MOCKS. Every screen in this module reads the real ledger or shows
// an empty state — a mocked rupee figure in an accounting screen is worse
// than no figure at all, because it looks like money that exists.
//
// The same zod schemas still run over every response, so a backend contract
// break fails loudly here rather than as a wrong total on screen.

import { api } from '../../../lib/axios'
import {
  accountingConfigSchema,
  accountingOverviewSchema,
  accountingRefundDetailSchema,
  accountingRefundListSchema,
  accountingRefundSchema,
  accountingTransactionDetailSchema,
  accountingTransactionListSchema,
  accountingTransactionSchema,
  auditLogListSchema,
  codRemittanceSchema,
  commissionOptionsSchema,
  commissionPreviewSchema,
  commissionRuleListSchema,
  commissionRuleSchema,
  commissionSummarySchema,
  payoutDetailSchema,
  payoutListSchema,
  payoutSchema,
  pendingCodListSchema,
  reportCatalogueSchema,
  reportResultSchema,
  sellerLedgerDetailSchema,
  sellerLedgerListSchema,
  settlementDetailSchema,
  settlementGenerateSchema,
  settlementListSchema,
  settlementSchema,
} from '../schemas/accountingSchema'

const BASE = '/admin/accounting'

// The backend always responds { success, message, data }; unwrap `data` and
// validate it.
async function read(path, { params, schema } = {}) {
  const { data } = await api.get(path, { params })
  return schema ? schema.parse(data.data) : data.data
}

async function write(method, path, { body, schema } = {}) {
  const { data } = await api[method](path, body)
  return schema ? schema.parse(data.data) : data.data
}

// useListController hands every list { tab, filters, sort, page, rowsPerPage }.
// Filters are flattened onto the query string because that is what the
// controllers read (req.query.sellerId, req.query.range, …).
const listParams = (query = {}) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...(query.filters || {}),
})

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export const fetchAccountingOverview = (params) =>
  read(`${BASE}/overview`, { params, schema: accountingOverviewSchema })

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const fetchAccountingTransactions = (query) =>
  read(`${BASE}/transactions`, { params: listParams(query), schema: accountingTransactionListSchema })

export const fetchAccountingTransaction = (id) =>
  read(`${BASE}/transactions/${id}`, { schema: accountingTransactionDetailSchema })

export const fetchPendingCod = (query) =>
  read(`${BASE}/transactions/cod-pending`, { params: listParams(query), schema: pendingCodListSchema })

export const recordCodRemittance = ({ orderId, reference }) =>
  write('post', `${BASE}/transactions/cod-remittance`, {
    body: { orderId, reference },
    schema: codRemittanceSchema,
  })

// ---------------------------------------------------------------------------
// Seller ledger
// ---------------------------------------------------------------------------

export const fetchSellerLedgers = (query) =>
  read(`${BASE}/seller-ledger`, { params: listParams(query), schema: sellerLedgerListSchema })

export const fetchSellerLedger = (sellerId, params) =>
  read(`${BASE}/seller-ledger/${sellerId}`, { params, schema: sellerLedgerDetailSchema })

export const createAdjustment = ({ sellerId, amount, direction, reason, orderId }) =>
  write('post', `${BASE}/seller-ledger/${sellerId}/adjustments`, {
    body: { amount, direction, reason, orderId },
    schema: accountingTransactionSchema,
  })

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export const fetchCommissionRules = (query) =>
  read(`${BASE}/commissions`, { params: listParams(query), schema: commissionRuleListSchema })

export const fetchCommissionOptions = (product) =>
  read(`${BASE}/commissions/options`, { params: { product }, schema: commissionOptionsSchema })

export const fetchCommissionSummary = () => read(`${BASE}/commissions/summary`, { schema: commissionSummarySchema })

// A POST because it takes a body; it writes nothing.
export const previewCommission = (body) =>
  write('post', `${BASE}/commissions/preview`, { body, schema: commissionPreviewSchema })

export const createCommissionRule = (body) =>
  write('post', `${BASE}/commissions`, { body, schema: commissionRuleSchema })

export const updateCommissionRule = ({ id, ...body }) =>
  write('put', `${BASE}/commissions/${id}`, { body, schema: commissionRuleSchema })

export const setCommissionRuleStatus = ({ id, isActive, reason }) =>
  write('patch', `${BASE}/commissions/${id}/status`, {
    body: { isActive, reason },
    schema: commissionRuleSchema,
  })

export const fetchAccountingConfig = () => read(`${BASE}/config`, { schema: accountingConfigSchema })

export const updateAccountingConfig = (body) =>
  write('patch', `${BASE}/config`, { body, schema: accountingConfigSchema })

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export const fetchSettlements = (query) =>
  read(`${BASE}/settlements`, { params: listParams(query), schema: settlementListSchema })

export const fetchSettlement = (id) =>
  read(`${BASE}/settlements/${id}`, { schema: settlementDetailSchema })

export const generateSettlements = ({ sellerId } = {}) =>
  write('post', `${BASE}/settlements/generate`, { body: { sellerId }, schema: settlementGenerateSchema })

export const holdSettlement = ({ id, reason }) =>
  write('post', `${BASE}/settlements/${id}/hold`, { body: { reason }, schema: settlementSchema })

export const releaseSettlement = ({ id }) =>
  write('post', `${BASE}/settlements/${id}/release`, { body: {}, schema: settlementSchema })

// POST /admin/accounting/settlements/:id/release-transfer — drives the
// settlement's Razorpay Route payout through create+hold+release right now
// instead of waiting for settlementReleaseJob's cron. The response is NOT
// always a Payout: when there is nothing actionable yet (already
// released/completed, or blocked — NOT_TRANSFERABLE / HELD /
// SKIPPED_MANUAL_MODE / ALREADY_EXISTS) the backend instead returns
// `{ settlementId, outcome, reason, detail }` with success:true, so there is
// no fixed schema here — the caller branches on whether `payoutId` is present.
export const releaseSettlementTransfer = ({ id }) =>
  write('post', `${BASE}/settlements/${id}/release-transfer`, { body: {} })

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export const fetchPayouts = (query) =>
  read(`${BASE}/payouts`, { params: listParams(query), schema: payoutListSchema })

export const fetchPayout = (id) => read(`${BASE}/payouts/${id}`, { schema: payoutDetailSchema })

export const createPayout = ({ settlementId, method, notes }) =>
  write('post', `${BASE}/payouts`, { body: { settlementId, method, notes }, schema: payoutSchema })

export const updatePayoutStatus = ({ id, status, utr, providerReference, failureReason }) =>
  write('patch', `${BASE}/payouts/${id}/status`, {
    body: { status, utr, providerReference, failureReason },
    schema: payoutSchema,
  })

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const fetchAccountingRefunds = (query) =>
  read(`${BASE}/refunds`, { params: listParams(query), schema: accountingRefundListSchema })

export const fetchAccountingRefund = (id) =>
  read(`${BASE}/refunds/${encodeURIComponent(id)}`, { schema: accountingRefundDetailSchema })

export const approveRefund = ({ id, reason }) =>
  write('post', `${BASE}/refunds/${encodeURIComponent(id)}/approve`, {
    body: { reason },
    schema: accountingRefundSchema,
  })

export const rejectRefund = ({ id, reason }) =>
  write('post', `${BASE}/refunds/${encodeURIComponent(id)}/reject`, {
    body: { reason },
    schema: accountingRefundSchema,
  })

// ---------------------------------------------------------------------------
// Reports & audit
// ---------------------------------------------------------------------------

export const fetchReportCatalogue = () => read(`${BASE}/reports`, { schema: reportCatalogueSchema })

export const runAccountingReport = (reportKey, params) =>
  read(`${BASE}/reports/${reportKey}`, { params, schema: reportResultSchema })

export const fetchAccountingAuditLog = (query) =>
  read(`${BASE}/audit-log`, { params: listParams(query), schema: auditLogListSchema })
