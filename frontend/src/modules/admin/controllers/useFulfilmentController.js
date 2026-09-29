// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { fetchInvoiceDetail, fetchInvoices, fetchReturnDetail, fetchReturns } from '../services/fulfilmentService'
import * as service from '../services/fulfilmentService'
import { useListController } from './useListController'
import { useAdminMutation } from './useAdminMutation'

export const useReturnListController = () =>
  useListController({ queryKey: ['admin', 'returns'], queryFn: fetchReturns })

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
  confirmDelivery: useAdminMutation({
    mutationFn: service.confirmSubOrderDelivery,
    invalidate: FULFILMENT,
    success: (row) => `${row.id} delivery confirmed`,
    describe: () => 'It can now be included in the seller’s next settlement.',
  }),
  cancel: useAdminMutation({
    mutationFn: service.cancelSubOrder,
    invalidate: FULFILMENT,
    success: (row) => `${row.id} cancelled`,
    describe: () => 'A refund row was raised for it.',
    onDone,
  }),
})

export const useReturnWriteController = ({ onDone } = {}) => ({
  decide: useAdminMutation({
    mutationFn: service.decideReturn,
    invalidate: FULFILMENT,
    success: (row) => `${row.subOrderId} — ${row.status.replace(/_/g, ' ')}`,
    onDone,
  }),
  received: useAdminMutation({
    mutationFn: service.markReturnReceived,
    invalidate: FULFILMENT,
    success: () => 'Item marked received',
    onDone,
  }),
  complete: useAdminMutation({
    mutationFn: service.completeReturn,
    invalidate: FULFILMENT,
    success: (row) => `${row.subOrderId} — ${row.status.replace(/_/g, ' ')}`,
    onDone,
  }),
})
