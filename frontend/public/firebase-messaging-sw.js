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

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'Krozenda', {
    body: body || '',
    icon: '/images/logo.png',
  })
})
