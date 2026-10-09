// Forced in-app update (Google Play In-App Updates, IMMEDIATE flow = full-screen blocking update).
// Port of the Flutter wrapper's in_app_update_service.dart, but always forced: whenever Play reports a
// newer version the immediate flow is started, and it is re-checked on every return to the foreground so
// an update the user backed out of is offered again straight away. Only works for builds installed from
// Google Play - for a side-loaded APK Play reports nothing and this silently does nothing.
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import Constants from 'expo-constants'
import SpInAppUpdates, { IAUUpdateKind } from 'sp-react-native-in-app-updates'

const MIN_GAP_MS = 60_000 // do not hammer Play on rapid foreground/background flips
let checking = false
let lastCheck = 0
let client = null

async function checkAndForceUpdate() {
  if (Platform.OS !== 'android' || checking) return
  if (Date.now() - lastCheck < MIN_GAP_MS) return
  checking = true
  lastCheck = Date.now()
  try {
    client = client || new SpInAppUpdates(false)
    const result = await client.checkNeedsUpdate({ curVersion: Constants.expoConfig?.version || '0.0.0' })
    if (result?.shouldUpdate) {
      await client.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE })
    }
  } catch {
    // Not installed from Play, offline, or the user dismissed the flow - re-checked on next resume.
  } finally {
    checking = false
  }
}

export function useForcedInAppUpdate() {
  useEffect(() => {
    const first = setTimeout(checkAndForceUpdate, 1500)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkAndForceUpdate()
    })
    return () => {
      clearTimeout(first)
      sub.remove()
    }
  }, [])
}
