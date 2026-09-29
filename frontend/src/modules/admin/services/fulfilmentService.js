// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/fulfilment'
const { returnDetailFixture, returnListFixture, shipmentListFixture } = fixtures
import { invoiceDetailSchema, invoiceListSchema, returnDetailSchema, returnListSchema, shipmentListSchema, returnSchema, subOrderSchema } from '../schemas/fulfilmentSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchShipments = (query) =>
  fetchResource({
    path: '/admin/shipments',
    params: params(query),
    fixture: () => shipmentListFixture(query),
    schema: shipmentListSchema,
    live: true,
  })

export const fetchReturns = (query) =>
  fetchResource({
    path: '/admin/returns',
    params: params(query),
    fixture: () => returnListFixture(query),
    schema: returnListSchema,
    live: true,
  })

export const fetchReturnDetail = (returnId) =>
  fetchResource({
    path: `/admin/returns/${returnId}`,
    fixture: () => returnDetailFixture(returnId),
    schema: returnDetailSchema,
    live: true,
  })

// Invoices are derived from orders by the backend's invoiceService — the same
// code behind the buyer's own invoice — so there is no fixture for them.
export const fetchInvoices = (query) =>
  fetchResource({
    path: '/admin/invoices',
    params: params(query),
    schema: invoiceListSchema,
    live: true,
  })

export const fetchInvoiceDetail = (invoiceId) =>
  fetchResource({
    path: `/admin/invoices/${invoiceId}`,
    schema: invoiceDetailSchema,
    live: true,
  })

// --- writes ---------------------------------------------------------------

// Vouch for a line the seller marked delivered, releasing it to settlement.
export const confirmSubOrderDelivery = ({ id }) =>
  mutateResource({ path: `/admin/fulfilment/sub-orders/${id}/confirm-delivery`, body: {}, schema: subOrderSchema, live: true })

export const advanceSubOrder = ({ id, awb }) =>
  mutateResource({ path: `/admin/fulfilment/sub-orders/${id}/advance`, body: { awb }, fixture: (p) => fixtures.advanceSubOrderFixture(id, p), schema: subOrderSchema, live: true })

export const cancelSubOrder = ({ id, reason }) =>
  mutateResource({ path: `/admin/fulfilment/sub-orders/${id}/cancel`, body: { reason }, fixture: (p) => fixtures.cancelSubOrderFixture(id, p), schema: subOrderSchema, live: true })

// APPROVED accepts the return (pickup booked, no money yet); REJECTED needs a
// reason. `requireItemBack: false` completes at once (nothing to send back).
export const decideReturn = ({ id, decision, reason, requireItemBack = true, restock = false }) =>
  mutateResource({ path: `/admin/returns/${id}/decide`, body: { decision, reason, requireItemBack, restock }, fixture: (p) => fixtures.decideReturnFixture(id, p), schema: returnSchema, live: true })

export const markReturnReceived = ({ id }) =>
  mutateResource({ path: `/admin/returns/${id}/received`, body: {}, fixture: () => fixtures.decideReturnFixture(id, {}), schema: returnSchema, live: true })

// Pays the refund (to the original payment where there is one) or creates the
// replacement order; `restock` puts the returned units back on sale.
export const completeReturn = ({ id, restock = false }) =>
  mutateResource({ path: `/admin/returns/${id}/complete`, body: { restock }, fixture: () => fixtures.decideReturnFixture(id, {}), schema: returnSchema, live: true })
