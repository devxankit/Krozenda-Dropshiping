import { useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { setOnline } from './netState'

// { isOnline, justReconnected } - same contract as the web hook. NetInfo's isInternetReachable is
// null while unknown; only an explicit false counts as offline.
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [justReconnected, setJustReconnected] = useState(false)
  const wasOffline = useRef(false)
  useEffect(() => {
    let t
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false
      setOnline(online)
      setIsOnline(online)
      if (!online) wasOffline.current = true
      else if (wasOffline.current) {
        wasOffline.current = false
        setJustReconnected(true)
        clearTimeout(t)
        t = setTimeout(() => setJustReconnected(false), 2500)
      }
    })
    return () => {
      unsub()
      clearTimeout(t)
    }
  }, [])
  return { isOnline, justReconnected }
}
