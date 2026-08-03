// Reads and validates process.env. This is the ONLY module in the app
// allowed to touch process.env directly — everything else imports `env`
// from here so there is one place that knows the variable names.

import dotenv from 'dotenv'

dotenv.config()

const RAW = process.env

// Keys that must be non-empty for the app to boot. Extend this list as a
// module starts depending on a key (e.g. add RAZORPAY_KEY_SECRET once
// checkout is implemented) — leave keys optional until something reads them.
const REQUIRED_KEYS = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']

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
  nodeEnv: RAW.NODE_ENV || 'development',
  port: Number(RAW.PORT) || 5000,
  clientUrl: RAW.CLIENT_URL || 'http://localhost:5173',
  mongoUri: RAW.MONGODB_URI,
  jwt: Object.freeze({
    accessSecret: RAW.JWT_ACCESS_SECRET,
    accessExpiresIn: RAW.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: RAW.JWT_REFRESH_SECRET,
    refreshExpiresIn: RAW.JWT_REFRESH_EXPIRES_IN || '30d',
  }),
  razorpay: Object.freeze({
    keyId: RAW.RAZORPAY_KEY_ID || '',
    keySecret: RAW.RAZORPAY_KEY_SECRET || '',
  }),
  shiprocket: Object.freeze({
    email: RAW.SHIPROCKET_EMAIL || '',
    password: RAW.SHIPROCKET_PASSWORD || '',
  }),
  firebase: Object.freeze({
    projectId: RAW.FIREBASE_PROJECT_ID || '',
    clientEmail: RAW.FIREBASE_CLIENT_EMAIL || '',
    privateKey: RAW.FIREBASE_PRIVATE_KEY || '',
  }),
  smsIndiaHub: Object.freeze({
    apiKey: RAW.SMS_INDIA_HUB_API_KEY || '',
    senderId: RAW.SMS_INDIA_HUB_SENDER_ID || '',
  }),
  smtp: Object.freeze({
    host: RAW.SMTP_HOST || '',
    port: Number(RAW.SMTP_PORT) || 587,
    user: RAW.SMTP_USER || '',
    password: RAW.SMTP_PASSWORD || '',
  }),
  isDev: (RAW.NODE_ENV || 'development') === 'development',
  isProd: RAW.NODE_ENV === 'production',
})
