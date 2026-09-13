// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchProfile, updateProfile, uploadProfileImage } from '../services/profileService'
import { useAuthStore } from '../../../lib/authStore'
import { storage } from '../../../lib/storage'

const QUERY_KEY = ['user', 'profile']

// Keeps authStore/localStorage (what ProfileDashboardScreen and the rest of
// the app read today) in sync whenever the server hands back a fresh profile.
function syncAuthStore(user) {
  useAuthStore.setState({ user })
  storage.setUserData(user)
}

export function useProfileController() {
  const queryClient = useQueryClient()

  const profileQuery = useQuery({ queryKey: QUERY_KEY, queryFn: fetchProfile })

  const updateMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (user) => {
      queryClient.setQueryData(QUERY_KEY, user)
      syncAuthStore(user)
    },
  })

  const imageMutation = useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: (user) => {
      queryClient.setQueryData(QUERY_KEY, user)
      syncAuthStore(user)
    },
  })

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    uploadImage: imageMutation.mutateAsync,
    isUploadingImage: imageMutation.isPending,
    imageError: imageMutation.error,
  }
}
