// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../lib/authStore'
import { ADMIN_ROUTES } from '../../../config/routes'
import {
  requestAdminLogin,
  requestPasswordReset,
  submitPasswordReset,
  verifyAdminTwoFactor,
} from '../services/authService'

// The password step never creates a session — it only opens a two-factor
// challenge. The session is minted at the 2FA step, which is what makes 2FA
// non-skippable rather than merely encouraged.
const CHALLENGE_KEY = 'krozenda.admin.challenge'

function rememberChallenge(challenge) {
  try {
    sessionStorage.setItem(CHALLENGE_KEY, JSON.stringify(challenge))
  } catch {
    // Storage unavailable — the 2FA screen falls back to a generic prompt.
  }
}

export function readChallenge() {
  try {
    const raw = sessionStorage.getItem(CHALLENGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearChallenge() {
  try {
    sessionStorage.removeItem(CHALLENGE_KEY)
  } catch {
    // no-op
  }
}

export function useAdminLoginController() {
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: requestAdminLogin,
    onSuccess: (challenge) => {
      rememberChallenge(challenge)
      navigate(ADMIN_ROUTES.TWO_FACTOR)
    },
  })

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  }
}

export function useAdminTwoFactorController() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setSession)
  // Read the challenge ONCE, on mount. Reading it on every render made this
  // screen redirect itself: clearing the challenge on success re-rendered the
  // page with a null challenge, and the "no challenge -> back to sign-in"
  // guard below then raced the navigation to the dashboard and won.
  const [challenge] = useState(readChallenge)

  const mutation = useMutation({
    mutationFn: verifyAdminTwoFactor,
    onSuccess: (session) => {
      setSession(session)
      clearChallenge()
      navigate(ADMIN_ROUTES.DASHBOARD, { replace: true })
    },
  })

  return {
    challenge,
    submit: (code) => mutation.mutate({ code, challengeId: challenge?.challengeId }),
    isSubmitting: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}

export function useForgotPasswordController() {
  const mutation = useMutation({ mutationFn: requestPasswordReset })
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
    onSuccess: () => navigate(ADMIN_ROUTES.LOGIN, { replace: true }),
  })

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  }
}
