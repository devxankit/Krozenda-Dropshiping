// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import {
  fetchCancellations,
  fetchInvoiceDetail,
  fetchInvoices,
  fetchReturnDetail,
  fetchReturns,
  fetchRtos,
  fetchShipments,
  fetchSubOrders,
} from '../services/fulfilmentService'
import * as service from '../services/fulfilmentService'
import { useListController } from './useListController'
import { useAdminMutation } from './useAdminMutation'

export const useSubOrderListController = () =>
  useListController({ queryKey: ['admin', 'sub-orders'], queryFn: fetchSubOrders })

export const useShipmentListController = () =>
  useListController({ queryKey: ['admin', 'shipments'], queryFn: fetchShipments })

export const useRtoListController = () =>
  useListController({ queryKey: ['admin', 'rto'], queryFn: fetchRtos })

export const useReturnListController = () =>
  useListController({ queryKey: ['admin', 'returns'], queryFn: fetchReturns })

export const useCancellationListController = () =>
  useListController({ queryKey: ['admin', 'cancellations'], queryFn: fetchCancellations })

export const useInvoiceListController = () =>
  useListController({ queryKey: ['admin', 'invoices'], queryFn: fetchInvoices })

export function useReturnDetailController(returnId) {
  const query = useQuery({
    queryKey: ['admin', 'returns', returnId],
    queryFn: () => fetchReturnDetail(returnId),
    enabled: Boolean(returnId),
  })
  return { request: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useInvoiceDetailController(invoiceId) {
  const query = useQuery({
    queryKey: ['admin', 'invoices', invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    enabled: Boolean(invoiceId),
  })
  return { invoice: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

// A sub-order moving forward changes the parent order's rolled-up status and
// can create a cancellation row, so fulfilment writes invalidate orders too.
const FULFILMENT = [['admin', 'fulfilment'], ['admin', 'orders']]

export const useSubOrderWriteController = ({ onDone } = {}) => ({
  advance: useAdminMutation({
    mutationFn: service.advanceSubOrder,
    invalidate: FULFILMENT,
    success: (row) => `${row.id} is now ${row.status.replace(/_/g, ' ')}`,
    describe: (row) => (row.awb ? `AWB ${row.awb}` : undefined),
  }),
  cancel: useAdminMutation({
    mutationFn: service.cancelSubOrder,
    invalidate: FULFILMENT,
    success: (row) => `${row.id} cancelled`,
    describe: () => 'A refund row was raised for it.',
    onDone,
  }),
})

export const useShipmentWriteController = () => ({
  update: useAdminMutation({
    mutationFn: service.updateShipment,
    invalidate: FULFILMENT,
    success: (row) => `${row.awb} marked ${row.status.replace(/_/g, ' ')}`,
  }),
})

export const useRtoWriteController = () => ({
  restock: useAdminMutation({
    mutationFn: service.restockRto,
    invalidate: FULFILMENT,
    success: (row) => `${row.subOrderId} back in stock`,
    describe: (row) => (row.costBearer === 'vendor' ? 'The vendor settlement was reversed.' : 'The platform bears the freight.'),
  }),
})

export const useReturnWriteController = ({ onDone } = {}) => ({
  decide: useAdminMutation({
    mutationFn: service.decideReturn,
    invalidate: FULFILMENT,
    success: (row) => `${row.subOrderId} — ${row.status.replace(/_/g, ' ')}`,
    onDone,
  }),
})

export const useCancellationWriteController = () => ({
  refund: useAdminMutation({
    mutationFn: service.resolveCancellationRefund,
    invalidate: FULFILMENT,
    success: (row) => `Refund for ${row.subOrderId} paid`,
  }),
})

export const useInvoiceWriteController = ({ onDone } = {}) => ({
  void: useAdminMutation({
    mutationFn: service.voidInvoice,
    invalidate: FULFILMENT,
    success: (row) => `Invoice ${row.number} voided`,
    describe: () => 'The number stays in the series — reissue against the same sub-order.',
    onDone,
  }),
})
