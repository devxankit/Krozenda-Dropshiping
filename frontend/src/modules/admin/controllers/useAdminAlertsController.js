// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.
//
// Operational alerts for the team (CJ order failed, refund failed, seller
// payout bounced, payment captured with no order, new seller application,
// return request, high-value order) — raised by the backend's
// services/adminAlertService over the socket AND as an FCM push.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { currentPushToken, describePush, onForegroundMessage, requestPushToken } from '../../../lib/firebase'
import { onRealtime } from '../../../lib/realtime'
import { toast } from '../../../lib/toast'
import { registerAdminPushToken, removeAdminPushToken } from '../services/shellService'

export function useAdminAlertsController() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // The socket and the foreground push carry the same alert id, and a toast
    // with an id that is already showing is replaced rather than stacked — so
    // an open panel shows each alert once.
    // Tapping the OS notification opens the alert's page (service worker);
    // the in-panel toast only needs to be noticed.
    function show({ id, title, message }) {
      if (!title) return
      toast.warning(title, message || '', { id: id || undefined, duration: 8000 })
      // Sidebar badges (open returns, failed payouts, pending KYC).
      queryClient.invalidateQueries({ queryKey: ['admin', 'shell-summary'] })
    }

    const offSocket = onRealtime('notification', (payload) => show(payload || {}))

    let offPush = () => {}
    let cancelled = false
    onForegroundMessage((payload) => {
      const { title, body } = describePush(payload)
      show({ id: payload?.data?.alertId, title, message: body })
    }).then((off) => {
      if (cancelled) off()
      else offPush = off
    })

    // Best-effort: a declined prompt or unsupported browser just means no
    // push on this device — the socket still works while the panel is open.
    if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
      requestPushToken()
        .then((token) => (token ? registerAdminPushToken(token) : null))
        .catch(() => {})
    }

    return () => {
      cancelled = true
      offSocket()
      offPush()
    }
  }, [queryClient])
}

// Called before the session is cleared, so this device stops receiving
// alerts meant for the admin who just signed out. Capped, so a slow or
// failing request never holds the sign-out.
export async function unregisterAdminPush() {
  const attempt = currentPushToken().then((token) => (token ? removeAdminPushToken(token) : null))
  await Promise.race([attempt.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))])
}
