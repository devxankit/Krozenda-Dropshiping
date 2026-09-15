// Handles push while the tab is backgrounded/closed. A service worker can't
// read import.meta.env, so this config is inlined directly — these are the
// same public, client-safe web config values already shipped in the app
// bundle (see src/config/env.js), not secrets.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCPfYIkEx37GVKxyBcqcuPhkZjkyDTJBpE',
  projectId: 'krozenda-f9b5c',
  messagingSenderId: '267446179597',
  appId: '1:267446179597:web:ce1102e3405f0827878244',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'Krozenda', {
    body: body || '',
    icon: '/images/logo.png',
  })
})
