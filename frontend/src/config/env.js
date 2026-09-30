// Reads and validates import.meta.env. This is the ONLY module in the app
// allowed to touch import.meta.env directly — everything else imports `env`
// from here so there is one place that knows the variable names.

const RAW = import.meta.env

export const env = Object.freeze({
  appName: RAW.VITE_APP_NAME || 'Krozenda',
  appEnv: RAW.VITE_APP_ENV || 'development',
  apiBaseUrl: RAW.VITE_API_BASE_URL || '/api/v1',
  apiTimeoutMs: Number(RAW.VITE_API_TIMEOUT_MS) || 15000,
  // Fixture data for the few admin reads not marked `live` in their service.
  // Off unless VITE_USE_MOCKS=true is set explicitly: a screen whose endpoint
  // is missing must show its error state, never invented figures.
  useMocks: RAW.VITE_USE_MOCKS === 'true',
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
  // True only under the Vite dev server — never in any `vite build`, whatever
  // VITE_APP_ENV says. For things that must never ship (demo credentials).
  isDevServer: Boolean(RAW.DEV),
  // Demo seller sign-ins, pre-filled on the seller login page in local dev
  // only. Behind a literal import.meta.env.DEV so a production build drops
  // them entirely — they are not in the shipped JS at all.
  // The admin sign-in pre-fill, same rule: dev server only, absent from any
  // build. It is the real bootstrap admin from backend/.env — shipping it in
  // the public bundle published the super-admin password.
  demoAdminLogin: import.meta.env.DEV
    ? Object.freeze({ email: 'admin@example.com', password: 'Krozenda@Admin123' })
    : null,
  demoSellerLogins: import.meta.env.DEV
    ? Object.freeze({
        B2C: { email: 'b2c.demo@krozenda.com', password: 'Demo@1234' },
        B2B: { email: 'b2b.demo@krozenda.com', password: 'Demo@1234' },
      })
    : null,
  isProd: RAW.VITE_APP_ENV === 'production',
})
