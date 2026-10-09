// Native push (FCM). The Flutter wrapper used firebase_messaging; here expo-notifications returns
// the same native FCM token on Android (google-services.json is wired in app.json).
import { Notifications } from './expoNotifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { api } from './axios'

export const CHANNEL_ID = 'webview_notifications'

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function ensureChannel() {
  if (!Notifications || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Krozenda Notifications',
    importance: Notifications.AndroidImportance.HIGH,
  })
}

let lastRegistered = null

// Requests permission (Android 13+), reads the native FCM token and files it against the signed-in
// account: POST /fcm-token { token, deviceType: 'app' }.
export async function registerForPush() {
  if (!Notifications || !Device.isDevice) return null
  await ensureChannel()
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync())
  if (status !== 'granted') return null
  const { data: token } = await Notifications.getDevicePushTokenAsync()
  if (!token || token === lastRegistered) return token
  await api.post('/fcm-token', { token, deviceType: 'app' })
  lastRegistered = token
  return token
}

// Called BEFORE the session is cleared (needs the JWT), capped so a slow request never holds sign-out.
export async function unregisterPushToken() {
  if (!Notifications) return
  const attempt = Notifications.getDevicePushTokenAsync().then(({ data: token }) =>
    token ? api.delete('/fcm-token', { data: { token } }) : null,
  )
  await Promise.race([attempt.catch(() => {}), new Promise((resolve) => setTimeout(resolve, 1500))])
  lastRegistered = null
}

// '/app/orders/123' or 'https://krozenda.com/app/orders/123' -> '/orders/123'
export function linkToRoute(link) {
  if (!link) return null
  let path = String(link)
  try {
    if (/^https?:\/\//i.test(path)) {
      const url = new URL(path)
      path = url.pathname + url.search
    }
  } catch {
    return null
  }
  return path.replace(/^\/app(?=\/|$)/, '') || '/'
}
