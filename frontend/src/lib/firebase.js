// FCM push notifications ONLY — see env.js and project context §4.3.
// No Firebase Auth / Firestore / Storage anywhere in this app.

import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { env } from '../config/env'

let messagingPromise = null

async function getMessagingInstance() {
  if (!env.firebase.apiKey) return null
  if (!(await isSupported())) return null

  const app = initializeApp(env.firebase)
  return getMessaging(app)
}

function messaging() {
  if (!messagingPromise) messagingPromise = getMessagingInstance()
  return messagingPromise
}

// Asks for notification permission, registers the background service worker
// and returns an FCM device token — or null if the user declines, the
// browser doesn't support push, or Firebase isn't configured. Callers treat
// a null return as "skip silently", never as an error.
export async function requestPushToken() {
  const instance = await messaging()
  if (!instance) return null

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  return getToken(instance, { vapidKey: env.firebase.vapidKey, serviceWorkerRegistration: registration })
}

// Foreground messages (tab open and focused) don't trigger the service
// worker's background handler — this is how those get shown instead.
export async function onForegroundMessage(callback) {
  const instance = await messaging()
  if (!instance) return () => {}
  return onMessage(instance, callback)
}
