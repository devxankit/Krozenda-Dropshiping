// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.
//
// Accounts MVP — deliberately separate from useAccountingController.js (the
// existing, more complex module this task does not touch).

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/accountsService'
import { useAdminMutation } from './useAdminMutation'
import { useListController } from './useListController'

const ACCOUNTS = [['admin', 'accounts']]

export function useAccountsDashboardController(range = {}) {
  const query = useQuery({
    queryKey: ['admin', 'accounts', 'dashboard', range],
    queryFn: () => service.getDashboardSummary(range),
  })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export function useVendorPayoutSummaryController() {
  const query = useQuery({
    queryKey: ['admin', 'accounts', 'payouts', 'summary'],
    queryFn: () => service.getVendorPayoutSummary(),
  })
  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useVendorPayoutLogController() {
  return useListController({
    queryKey: ['admin', 'accounts', 'payouts', 'log'],
    queryFn: ({ page, rowsPerPage }) => service.listVendorPayouts({ page, limit: rowsPerPage }),
    defaultRowsPerPage: 10,
  })
}

export function useCreateVendorPayoutController({ onSaved } = {}) {
  return useAdminMutation({
    mutationFn: service.createVendorPayout,
    invalidate: ACCOUNTS,
    success: 'Payout recorded',
    onDone: onSaved,
  })
}

export function useTransactionsController(filters = {}) {
  return useListController({
    queryKey: ['admin', 'accounts', 'transactions', filters],
    queryFn: ({ page, rowsPerPage }) => service.listTransactions({ page, limit: rowsPerPage, ...filters }),
    defaultRowsPerPage: 10,
  })
}

export function useCreateTransactionController({ onSaved } = {}) {
  return useAdminMutation({
    mutationFn: service.createTransaction,
    invalidate: ACCOUNTS,
    success: 'Transaction added',
    onDone: onSaved,
  })
}

export function useLedgerController(filters = {}) {
  return useListController({
    queryKey: ['admin', 'accounts', 'ledger', filters],
    queryFn: ({ page, rowsPerPage }) => service.getLedger({ page, limit: rowsPerPage, ...filters }),
    defaultRowsPerPage: 10,
  })
}
