// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import {
  createStaff,
  deleteStaff,
  fetchStaffList,
  updateStaff,
  updateStaffPassword,
  updateStaffRole,
  updateStaffStatus,
} from '../services/staffService'
import { useAdminMutation } from './useAdminMutation'

const STAFF_KEY = ['admin', 'staff-management']

export function useStaffListController() {
  const query = useQuery({ queryKey: STAFF_KEY, queryFn: fetchStaffList })
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateStaffController(onDone) {
  return useAdminMutation({
    mutationFn: createStaff,
    invalidate: [STAFF_KEY],
    success: 'Staff created successfully',
    onDone,
  })
}

export function useUpdateStaffController(onDone) {
  return useAdminMutation({
    mutationFn: updateStaff,
    invalidate: [STAFF_KEY],
    success: 'Staff updated successfully',
    onDone,
  })
}

export function useStaffStatusController() {
  return useAdminMutation({
    mutationFn: updateStaffStatus,
    invalidate: [STAFF_KEY],
    success: (data) => (data.isActive ? 'Staff activated' : 'Staff deactivated'),
  })
}

export function useStaffRoleController(onDone) {
  return useAdminMutation({
    mutationFn: updateStaffRole,
    invalidate: [STAFF_KEY],
    success: 'Role updated',
    onDone,
  })
}

export function useStaffPasswordController(onDone) {
  return useAdminMutation({
    mutationFn: updateStaffPassword,
    success: 'Password updated',
    onDone,
  })
}

export function useDeleteStaffController(onDone) {
  return useAdminMutation({
    mutationFn: deleteStaff,
    invalidate: [STAFF_KEY],
    success: 'Staff deleted',
    onDone,
  })
}
