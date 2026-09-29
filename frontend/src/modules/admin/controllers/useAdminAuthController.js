// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../lib/authStore'
import { ADMIN_ROUTES } from '../../../config/routes'
import { toast } from '../../../lib/toast'
import {
  requestAdminLogin,
  requestPasswordReset,
  submitPasswordReset,
} from '../services/authService'

export function useAdminLoginController() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)

  // Login resolves straight to a session (see authService.requestAdminLogin).
  const mutation = useMutation({
    mutationFn: requestAdminLogin,
    onSuccess: (session) => {
      setSession(session)
      toast.success('Signed in', 'Welcome to Krozenda Admin Panel')
      navigate(ADMIN_ROUTES.DASHBOARD, { replace: true })
    },
    onError: (err) => {
      toast.error('Sign in failed', err)
    },
  })

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  }
}

export function useForgotPasswordController() {
  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      toast.success('Reset link sent', 'Check your email for password reset instructions')
    },
    onError: (err) => {
      toast.error('Request failed', err)
    },
  })
  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    isSent: mutation.isSuccess,
    error: mutation.error,
  }
}

export function useResetPasswordController() {
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: submitPasswordReset,
    onSuccess: () => {
      toast.success('Password updated', 'You can now sign in with your new password')
      navigate(ADMIN_ROUTES.LOGIN, { replace: true })
    },
    onError: (err) => {
      toast.error('Could not reset password', err)
    },
  })

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  }
}
