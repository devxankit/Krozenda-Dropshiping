// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import { createRole, deleteRole, fetchRoleList, updateRole } from '../services/roleService'
import { useAdminMutation } from './useAdminMutation'

const ROLE_KEY = ['admin', 'role-management']

export function useRoleListController() {
  const query = useQuery({ queryKey: ROLE_KEY, queryFn: fetchRoleList })
  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCreateRoleController(onDone) {
  return useAdminMutation({
    mutationFn: createRole,
    invalidate: [ROLE_KEY],
    success: 'Role created successfully',
    onDone,
  })
}

export function useUpdateRoleController(onDone) {
  return useAdminMutation({
    mutationFn: updateRole,
    invalidate: [ROLE_KEY],
    success: 'Role updated successfully',
    onDone,
  })
}

export function useDeleteRoleController(onDone) {
  return useAdminMutation({
    mutationFn: deleteRole,
    // Deleting a role in use is rejected by the backend with a clear message
    // (surfaced via the mutation's own error toast), so staff lists don't
    // need invalidating on failure — only on a successful delete.
    invalidate: [ROLE_KEY],
    success: 'Role deleted',
    onDone,
  })
}
