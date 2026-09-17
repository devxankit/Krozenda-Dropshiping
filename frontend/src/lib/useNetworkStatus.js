import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Connectivity, as far as the browser/WebView will tell us.
//
// `navigator.onLine` is only trustworthy when it is FALSE — true merely means
// "there is a network interface", not "the internet is reachable", which is
// exactly the state a phone is in when it is attached to a captive portal or
// has one bar of nothing. So: offline is believed immediately, and coming
// back online is treated as "probably back" and confirmed by the first
// successful request rather than announced as certain.
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )
  // True for a few seconds after reconnecting, so the banner can say
  // "Back online" and then get out of the way instead of sitting there.
  const [justReconnected, setJustReconnected] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let reconnectTimer

    const handleOnline = () => {
      setIsOnline(true)
      setJustReconnected(true)
      reconnectTimer = setTimeout(() => setJustReconnected(false), 3000)

      // Refetch only what is BOTH mounted and stale. react-query's default
      // reconnect behaviour would refire every cached query at once, which is
      // the "20 duplicate requests the moment the connection returns" the
      // audit calls out (§121).
      queryClient.refetchQueries({ type: 'active', stale: true })
    }

    const handleOffline = () => {
      setIsOnline(false)
      setJustReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(reconnectTimer)
    }
  }, [queryClient])

  return { isOnline, justReconnected }
}
