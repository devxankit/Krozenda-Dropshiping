// Reads and validates import.meta.env. This is the ONLY module in the app
// allowed to touch import.meta.env directly — everything else imports `env`
// from here so there is one place that knows the variable names.

const RAW = import.meta.env

export const env = Object.freeze({
  appName: RAW.VITE_APP_NAME || 'Krozenda',
  appEnv: RAW.VITE_APP_ENV || 'development',
  apiBaseUrl: RAW.VITE_API_BASE_URL || '/api/v1',
  apiTimeoutMs: Number(RAW.VITE_API_TIMEOUT_MS) || 15000,
  // Admin panel screens run against a zod-validated fixtures layer until the
  // matching endpoints exist (5 of ~19 collections are modelled today). Set
  // VITE_USE_MOCKS=false to point every admin service at the real API.
  useMocks: RAW.VITE_USE_MOCKS !== 'false',
  mockLatencyMs: Number(RAW.VITE_MOCK_LATENCY_MS) || 320,
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
