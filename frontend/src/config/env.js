// Reads and validates import.meta.env. This is the ONLY module in the app
// allowed to touch import.meta.env directly — everything else imports `env`
// from here so there is one place that knows the variable names.

const RAW = import.meta.env

// Keys that must be non-empty for the app to boot. Extend this list as a
// module starts depending on a key (e.g. add VITE_RAZORPAY_KEY_ID once
// checkout is implemented) — leave keys optional until something reads them.
const REQUIRED_KEYS = ['VITE_API_BASE_URL', 'VITE_APP_ENV']

function readRequired() {
  const missing = REQUIRED_KEYS.filter((key) => !RAW[key])
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.',
    )
  }
}

readRequired()

export const env = Object.freeze({
  appName: RAW.VITE_APP_NAME || 'Krozenda',
  appEnv: RAW.VITE_APP_ENV,
  apiBaseUrl: RAW.VITE_API_BASE_URL,
  apiTimeoutMs: Number(RAW.VITE_API_TIMEOUT_MS) || 15000,
  razorpayKeyId: RAW.VITE_RAZORPAY_KEY_ID || '',
  firebase: Object.freeze({
    apiKey: RAW.VITE_FIREBASE_API_KEY || '',
    projectId: RAW.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: RAW.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: RAW.VITE_FIREBASE_APP_ID || '',
    vapidKey: RAW.VITE_FIREBASE_VAPID_KEY || '',
  }),
  isDev: RAW.VITE_APP_ENV === 'development',
  isProd: RAW.VITE_APP_ENV === 'production',
})
