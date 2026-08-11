// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMySellerProfile, registerSeller, uploadKycDocuments } from '../services/kycService'

const SELLER_PROFILE_KEY = ['vendor', 'seller-profile']

export function useKycController() {
  const queryClient = useQueryClient()

  // 404 ("no seller profile yet") is an expected first-visit state, not a
  // failure worth retrying — see isNotRegistered below.
  const profileQuery = useQuery({
    queryKey: SELLER_PROFILE_KEY,
    queryFn: fetchMySellerProfile,
    retry: false,
  })

  const registerMutation = useMutation({
    mutationFn: registerSeller,
    onSuccess: (seller) => queryClient.setQueryData(SELLER_PROFILE_KEY, seller),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadKycDocuments,
    onSuccess: (seller) => queryClient.setQueryData(SELLER_PROFILE_KEY, seller),
  })

  const isNotRegistered = profileQuery.isError && profileQuery.error?.status === 404

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    isNotRegistered,
    loadError: !isNotRegistered && profileQuery.isError ? profileQuery.error : null,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    uploadDocuments: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
  }
}
