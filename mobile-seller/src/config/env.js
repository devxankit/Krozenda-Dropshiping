// Single place for runtime configuration. Values come from mobile-seller/.env (EXPO_PUBLIC_* are
// inlined at build time) - public values only.
const RAW = process.env

export const env = Object.freeze({
  appName: RAW.EXPO_PUBLIC_APP_NAME || 'Krozenda Seller',
  appEnv: RAW.EXPO_PUBLIC_APP_ENV || 'production',
  apiBaseUrl: RAW.EXPO_PUBLIC_API_BASE_URL || 'https://krozenda.com/api',
  // Web origin: relative image URLs (/images/..., /uploads/...) and share links resolve against it.
  webOrigin: RAW.EXPO_PUBLIC_WEB_ORIGIN || 'https://krozenda.com',
  apiTimeoutMs: Number(RAW.EXPO_PUBLIC_API_TIMEOUT_MS) || 15000,
  firebase: Object.freeze({
    projectId: RAW.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    messagingSenderId: RAW.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: RAW.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  }),
  isProd: (RAW.EXPO_PUBLIC_APP_ENV || 'production') === 'production',
})
