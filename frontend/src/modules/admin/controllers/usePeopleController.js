// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import {
  createCustomer,
  createVendor,
  decideKycApplication,
  decideKycDocument,
  fetchCustomers,
  fetchKycApplication,
  fetchKycQueue,
  fetchPolicyAcceptances,
  fetchVendors,
  setVendorActive,
  syncVendorRazorpay,
  updateCustomerStatus,
} from '../services/peopleService'
import { useAdminMutation } from './useAdminMutation'
import { useListController } from './useListController'

export const useCustomerListController = () =>
  useListController({ queryKey: ['admin', 'customers'], queryFn: fetchCustomers, defaultRowsPerPage: 10 })

export const useCustomerWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: createCustomer,
    invalidate: [['admin', 'customers']],
    success: (customer) => `${customer.name} added`,
    onDone: onSaved,
  }),
  updateStatus: useAdminMutation({
    mutationFn: updateCustomerStatus,
    invalidate: [['admin', 'customers']],
    success: (customer) => (customer.status === 'active' ? 'Customer activated' : 'Customer blocked'),
  }),
})

export const useVendorListController = () =>
  useListController({ queryKey: ['admin', 'vendors'], queryFn: fetchVendors })

export const useVendorWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: createVendor,
    invalidate: [['admin', 'vendors']],
    success: (vendor) => `${vendor.name} onboarded`,
    describe: (vendor) =>
      vendor.isActive
        ? 'The partner is approved and live.'
        : 'The partner is registered and waiting on KYC verification.',
    onDone: onSaved,
  }),
  setActive: useAdminMutation({
    mutationFn: setVendorActive,
    invalidate: [['admin', 'vendors']],
    success: (vendor) => `${vendor.name} ${vendor.isActive ? 'activated' : 'suspended'}`,
  }),
})

export const useKycQueueController = () =>
  useListController({ queryKey: ['admin', 'kyc'], queryFn: fetchKycQueue })

export const usePolicyAcceptanceController = () =>
  useListController({ queryKey: ['admin', 'policy-acceptances'], queryFn: fetchPolicyAcceptances })

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useKycApplicationController = (applicationId) =>
  useResource(
    ['admin', 'kyc', applicationId],
    () => fetchKycApplication(applicationId),
    Boolean(applicationId),
  )

export const useKycDecisionController = ({ applicationId, onDone } = {}) => ({
  decideApplication: useAdminMutation({
    mutationFn: decideKycApplication,
    invalidate: [['admin', 'kyc'], ['admin', 'vendors']],
    success: (vendor) => `${vendor.name} marked ${vendor.verificationStatus.toLowerCase().replace('_', ' ')}`,
    onDone,
  }),
  decideDocument: useAdminMutation({
    mutationFn: decideKycDocument,
    invalidate: [
      ['admin', 'kyc', applicationId],
      ['admin', 'kyc'],
    ],
    success: (doc) => `${doc.documentLabel || doc.documentType} ${doc.status.toLowerCase()}`,
  }),
})

// Not part of the KYC read model — nothing joins vendor.razorpay into the
// application fetch, so this mutation's own response is the only place the
// panel gets its data from until the next sync.
export const useVendorRazorpaySyncController = ({ onDone } = {}) =>
  useAdminMutation({
    mutationFn: syncVendorRazorpay,
    invalidate: [['admin', 'vendors']],
    success: () => 'Razorpay Route synced',
    describe: (result) =>
      `${result.razorpay.onboardingStatus} · ${result.razorpay.isSettlementEligible ? 'Eligible for settlement' : 'Not eligible yet'}`,
    onDone,
  })
