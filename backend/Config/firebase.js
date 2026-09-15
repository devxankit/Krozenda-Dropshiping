const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let messaging = null;

function loadServiceAccount() {
  // 1. Try Base64 encoded env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e) {
      console.warn('[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  }

  // 2. Try generic env var (either Base64 or plain JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    try {
      return JSON.parse(raw);
    } catch {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        return JSON.parse(decoded);
      } catch (e) {
        console.warn('[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
      }
    }
  }

  // 3. Fallback to local JSON file if exists
  const localJsonPath = path.join(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(localJsonPath)) {
    try {
      return require(localJsonPath);
    } catch (e) {
      console.warn('[firebase] Failed to read firebase-service-account.json:', e.message);
    }
  }

  return null;
}

try {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    const app = initializeApp({ credential: cert(serviceAccount) });
    messaging = getMessaging(app);
  } else {
    console.warn('[firebase] Service account not configured (FIREBASE_SERVICE_ACCOUNT_BASE64 not set and file missing). Push notifications disabled.');
  }
} catch (err) {
  console.warn('[firebase] Service account initialization failed, push notifications disabled:', err.message);
}

module.exports = { messaging, isFirebaseConfigured: Boolean(messaging) };

