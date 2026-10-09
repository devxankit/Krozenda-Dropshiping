// Native push (FCM). The Flutter wrapper used firebase_messaging; here expo-notifications returns the
// same native FCM token on Android (google-services.json is wired in app.json). The backend stores the
// token against the signed-in vendor via POST /fcm-token { token, deviceType: 'app' } - the same call the
// web makes with deviceType 'web'.
import { Notifications } from './expoNotifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { api } from './axios'

// Same id the Expo config plugin writes as FCM's default channel (app.json), so pushes the system
// shows while the app is closed use this channel - high importance, with the wrapper's order ringtone.
export const CHANNEL_ID = 'webview_notifications'
const ORDER_SOUND = 'order_ringtone.mp3'

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
    name: 'New Order Alerts',
    description: 'Orders, shipments and account updates for your store',
    importance: Notifications.AndroidImportance.MAX,
    sound: ORDER_SOUND,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  })
}

let lastRegistered = null

async function fileToken(token) {
  if (!token || token === lastRegistered) return token
  await api.post('/fcm-token', { token, deviceType: 'app' })
  lastRegistered = token
  return token
}

// Sign-in: asks permission (Android 13+), reads the native FCM token and files it. Best effort - a
// declined permission must never block sign-in.
export async function registerForPush() {
  if (!Notifications || !Device.isDevice) return null
  try {
    await ensureChannel()
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync())
    if (status !== 'granted') return null
    const { data: token } = await Notifications.getDevicePushTokenAsync()
    return await fileToken(token)
  } catch {
    return null
  }
}

// Every time the panel opens (token rotation) - only when permission is already granted; never prompts.
export async function refreshPushToken() {
  if (!Notifications || !Device.isDevice) return null
  try {
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return null
    const { data: token } = await Notifications.getDevicePushTokenAsync()
    return await fileToken(token)
  } catch {
    return null
  }
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

// Title / body / link of a notification the app received while open.
export function describeNotification(notification) {
  const content = notification?.request?.content || {}
  const data = content.data || {}
  return { title: content.title || data.title || '', body: content.body || data.body || '', link: data.link || '' }
}

// '/seller/orders/123' or 'https://krozenda.com/seller/orders' -> '/orders/123'. Anything that is not a
// seller-panel link is ignored.
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
  if (!/^\/seller(\/|$)/.test(path)) return null
  return path.replace(/^\/seller(?=\/|$)/, '') || '/dashboard'
}
