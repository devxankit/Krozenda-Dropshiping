// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import {
  fetchCustomers,
  fetchKycApplication,
  fetchKycQueue,
  fetchPolicyAcceptances,
  fetchRoleDetail,
  fetchRoles,
  fetchStaff,
  fetchVendors,
} from '../services/peopleService'
import { useListController } from './useListController'

export const useCustomerListController = () =>
  useListController({ queryKey: ['admin', 'customers'], queryFn: fetchCustomers })

export const useVendorListController = () =>
  useListController({ queryKey: ['admin', 'vendors'], queryFn: fetchVendors })

export const useKycQueueController = () =>
  useListController({ queryKey: ['admin', 'kyc'], queryFn: fetchKycQueue })

export const usePolicyAcceptanceController = () =>
  useListController({ queryKey: ['admin', 'policy-acceptances'], queryFn: fetchPolicyAcceptances })

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useStaffController = () => useResource(['admin', 'staff'], fetchStaff)
export const useRolesController = () => useResource(['admin', 'roles'], fetchRoles)

export const useKycApplicationController = (applicationId) =>
  useResource(
    ['admin', 'kyc', applicationId],
    () => fetchKycApplication(applicationId),
    Boolean(applicationId),
  )

export const useRoleDetailController = (roleId) =>
  useResource(['admin', 'roles', roleId], () => fetchRoleDetail(roleId), Boolean(roleId))
