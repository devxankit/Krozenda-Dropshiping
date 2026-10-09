// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  removeAddress,
} from '../services/addressService'

const QUERY_KEY = ['user', 'addresses']

// Shared by MyAddressesScreen (full CRUD) and SelectAddressScreen (checkout
// step 1, read + add-new only) so both stay in sync via the same query key.
// `enabled: false` is for callers that render for signed-out visitors too —
// the product page's delivery check. A guest has no addresses, and asking for
// them would just be a 401 on every product view.
export function useAddressesController({ enabled = true } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAddresses, enabled })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })

  const createMutation = useMutation({ mutationFn: createAddress, onSuccess: invalidate })
  const updateMutation = useMutation({ mutationFn: updateAddress, onSuccess: invalidate })
  const setDefaultMutation = useMutation({ mutationFn: setDefaultAddress, onSuccess: invalidate })
  const removeMutation = useMutation({ mutationFn: removeAddress, onSuccess: invalidate })

  return {
    addresses: query.data || [],
    isLoading: query.isLoading,
    createAddress: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateAddress: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    setDefaultAddress: setDefaultMutation.mutateAsync,
    removeAddress: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,
    error: createMutation.error || updateMutation.error || removeMutation.error,
  }
}
