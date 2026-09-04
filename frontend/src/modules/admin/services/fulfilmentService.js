// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/fulfilment'
const {
  cancellationListFixture,
  invoiceDetailFixture,
  invoiceListFixture,
  returnDetailFixture,
  returnListFixture,
  rtoListFixture,
  shipmentListFixture,
  subOrderListFixture,
} = fixtures
import {
  cancellationListSchema,
  invoiceDetailSchema,
  invoiceListSchema,
  returnDetailSchema,
  returnListSchema,
  rtoListSchema,
  shipmentListSchema,
  subOrderListSchema,
  cancellationSchema,
  invoiceSchema,
  returnSchema,
  rtoSchema,
  shipmentSchema,
  subOrderSchema,
} from '../schemas/fulfilmentSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchSubOrders = (query) =>
  fetchResource({
    path: '/admin/sub-orders',
    params: params(query),
    fixture: () => subOrderListFixture(query),
    schema: subOrderListSchema,
  })

export const fetchShipments = (query) =>
  fetchResource({
    path: '/admin/shipments',
    params: params(query),
    fixture: () => shipmentListFixture(query),
    schema: shipmentListSchema,
  })

export const fetchRtos = (query) =>
  fetchResource({
    path: '/admin/rto',
    params: params(query),
    fixture: () => rtoListFixture(query),
    schema: rtoListSchema,
  })

export const fetchReturns = (query) =>
  fetchResource({
    path: '/admin/returns',
    params: params(query),
    fixture: () => returnListFixture(query),
    schema: returnListSchema,
  })

export const fetchReturnDetail = (returnId) =>
  fetchResource({
    path: `/admin/returns/${returnId}`,
    fixture: () => returnDetailFixture(returnId),
    schema: returnDetailSchema,
  })

export const fetchCancellations = (query) =>
  fetchResource({
    path: '/admin/cancellations',
    params: params(query),
    fixture: () => cancellationListFixture(query),
    schema: cancellationListSchema,
  })

export const fetchInvoices = (query) =>
  fetchResource({
    path: '/admin/invoices',
    params: params(query),
    fixture: () => invoiceListFixture(query),
    schema: invoiceListSchema,
  })

export const fetchInvoiceDetail = (invoiceId) =>
  fetchResource({
    path: `/admin/invoices/${invoiceId}`,
    fixture: () => invoiceDetailFixture(invoiceId),
    schema: invoiceDetailSchema,
  })

// --- writes ---------------------------------------------------------------

export const advanceSubOrder = ({ id, awb }) =>
  mutateResource({ path: `/admin/fulfilment/sub-orders/${id}/advance`, body: { awb }, fixture: (p) => fixtures.advanceSubOrderFixture(id, p), schema: subOrderSchema })

export const cancelSubOrder = ({ id, reason }) =>
  mutateResource({ path: `/admin/fulfilment/sub-orders/${id}/cancel`, body: { reason }, fixture: (p) => fixtures.cancelSubOrderFixture(id, p), schema: subOrderSchema })

export const updateShipment = ({ id, status, lastEvent }) =>
  mutateResource({ method: 'put', path: `/admin/fulfilment/shipments/${id}`, body: { status, lastEvent }, fixture: (p) => fixtures.updateShipmentFixture(id, p), schema: shipmentSchema })

export const restockRto = ({ id }) =>
  mutateResource({ path: `/admin/fulfilment/rto/${id}/restock`, body: { id }, fixture: () => fixtures.restockRtoFixture(id), schema: rtoSchema })

export const decideReturn = ({ id, decision, reason }) =>
  mutateResource({ path: `/admin/fulfilment/returns/${id}/decide`, body: { decision, reason }, fixture: (p) => fixtures.decideReturnFixture(id, p), schema: returnSchema })

export const resolveCancellationRefund = ({ id }) =>
  mutateResource({ path: `/admin/fulfilment/cancellations/${id}/refund`, body: { id }, fixture: () => fixtures.resolveCancellationRefundFixture(id), schema: cancellationSchema })

export const voidInvoice = ({ id, reason }) =>
  mutateResource({ method: 'put', path: `/admin/fulfilment/invoices/${id}/void`, body: { reason }, fixture: (p) => fixtures.voidInvoiceFixture(id, p), schema: invoiceSchema })
