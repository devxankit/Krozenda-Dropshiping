// Reads and validates import.meta.env. This is the ONLY module in the app
// allowed to touch import.meta.env directly — everything else imports `env`
// from here so there is one place that knows the variable names.

const RAW = import.meta.env

export const env = Object.freeze({
  appName: RAW.VITE_APP_NAME || 'Krozenda',
  appEnv: RAW.VITE_APP_ENV || 'development',
  apiBaseUrl: RAW.VITE_API_BASE_URL || '/api/v1',
  apiTimeoutMs: Number(RAW.VITE_API_TIMEOUT_MS) || 15000,
  razorpayKeyId: RAW.VITE_RAZORPAY_KEY_ID || '',
  firebase: Object.freeze({
    apiKey: RAW.VITE_FIREBASE_API_KEY || '',
    projectId: RAW.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: RAW.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: RAW.VITE_FIREBASE_APP_ID || '',
    vapidKey: RAW.VITE_FIREBASE_VAPID_KEY || '',
  }),
  isDev: (RAW.VITE_APP_ENV || 'development') === 'development',
  isProd: RAW.VITE_APP_ENV === 'production',
})
