// Handles push while the tab is backgrounded/closed. A service worker can't
// read import.meta.env, so this config is inlined directly — these are the
// same public, client-safe web config values already shipped in the app
// bundle (see src/config/env.js), not secrets.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyB45UzaDO-bEyqJVWKVPdBrpVMsTdE3am8',
  projectId: 'krozenda-a62bb',
  messagingSenderId: '778748845767',
  appId: '1:778748845767:web:f0fc02b7a257bdfc4928e2',
})

// Registered BEFORE firebase.messaging(): the SDK's own click listener calls
// stopImmediatePropagation, so anything added after it never sees SDK-drawn
// notifications. The SDK only opens a page when the push carried
// webpush.fcmOptions.link (backend FRONTEND_URL set to an https URL); every
// other tap — SDK-drawn without that link, or drawn by this worker — is
// routed here to data.link.
function openLink(event, link) {
  event.notification.close()
  const target = new URL(link || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse an open Krozenda tab rather than stacking new ones.
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        return existing.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : null))
      }
      return self.clients.openWindow(target)
    })
  )
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  const fcm = data.FCM_MSG
  if (fcm) {
    if (fcm.fcmOptions && fcm.fcmOptions.link) return // the SDK opens it
    event.stopImmediatePropagation()
    openLink(event, fcm.data && fcm.data.link)
    return
  }
  openLink(event, data.link)
})

const messaging = firebase.messaging()

// A message carrying a `notification` block is shown by the Firebase SDK
// itself (and opened via webpush.fcmOptions.link on tap), so showing it again
// here would put two copies on screen. Only data-only messages are drawn by
// hand.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return
  const data = payload.data || {}
  if (!data.title) return
  self.registration.showNotification(data.title, {
    body: data.body || '',
    icon: '/images/logo.png',
    data: { link: data.link || '/' },
  })
})
