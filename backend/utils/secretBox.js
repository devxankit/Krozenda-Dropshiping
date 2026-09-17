const crypto = require('crypto');

// Authenticated symmetric encryption for third-party credentials we must be
// able to REPLAY (a seller's Shiprocket password, which has to be sent to
// Shiprocket's login endpoint on every re-auth).
//
// Why not bcrypt/argon2: those are one-way. They are the right tool for our own
// user passwords, which we only ever need to COMPARE. They are the wrong tool
// here, because we need the plaintext back.
//
// AES-256-GCM rather than AES-CBC: GCM authenticates the ciphertext, so a
// tampered or truncated record fails to decrypt instead of silently yielding
// garbage that we would then post to a login endpoint.
//
// Threat model, stated honestly: this protects credentials AT REST in MongoDB —
// a leaked database dump, a backup file, a compromised read-only replica. It
// does NOT protect against an attacker who already has code execution on the
// API server, because that process must be able to decrypt by design. Keep the
// key out of the database and out of the repository.

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96 bits, the GCM-recommended nonce length
const ENVELOPE_VERSION = 1;

// Read lazily, not at module load: the key is only needed when a seller
// actually connects an account, and requiring it at boot would stop the whole
// API from starting on a deployment that does not use seller-owned shipping.
function readKey() {
  const raw = process.env.SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY;

  if (!raw) {
    const err = new Error(
      'SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY is not set. Seller-owned shipping accounts cannot be stored without it.'
    );
    err.code = 'ENCRYPTION_KEY_MISSING';
    err.status = 500;
    throw err;
  }

  // Accept either 64 hex characters or standard base64, so operators can
  // generate the key with whichever tool they have to hand.
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), 'hex');
  } else {
    key = Buffer.from(raw.trim(), 'base64');
  }

  if (key.length !== KEY_BYTES) {
    const err = new Error(
      `SHIPROCKET_CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). Generate one with: openssl rand -hex 32`
    );
    err.code = 'ENCRYPTION_KEY_INVALID';
    err.status = 500;
    throw err;
  }

  return key;
}

// True when the deployment is able to store seller credentials at all. Lets
// callers fail with a clear configuration error up front rather than throwing
// mid-way through a connection attempt.
function isConfigured() {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

// Returns a self-describing envelope string:  v1.<iv>.<authTag>.<ciphertext>
// Keeping the version in the payload means a future key rotation or algorithm
// change can decrypt old records instead of orphaning them.
function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encrypt() requires a non-empty string');
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, readKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    `v${ENVELOPE_VERSION}`,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join('.');
}

function decrypt(envelope) {
  if (typeof envelope !== 'string' || !envelope) {
    throw new Error('decrypt() requires an envelope string');
  }

  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== `v${ENVELOPE_VERSION}`) {
    const err = new Error('Stored credential is not in a recognised format');
    err.code = 'ENCRYPTION_ENVELOPE_INVALID';
    throw err;
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, readKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // GCM auth failure: wrong key, or the record was tampered with. Do not
    // echo any part of the ciphertext in the message.
    const err = new Error('Stored credential could not be decrypted');
    err.code = 'ENCRYPTION_AUTH_FAILED';
    throw err;
  }
}

// Constant-time compare for shared secrets (the webhook's x-api-key). A plain
// `===` on a secret leaks its length and prefix through timing.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself be a timing
  // signal — hash both sides to a fixed width first.
  const hashA = crypto.createHash('sha256').update(bufA).digest();
  const hashB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// For logs and support screens: never the credential, just enough to tell two
// accounts apart. "seller@example.com" -> "se****@example.com"
function maskEmail(email) {
  const value = String(email || '');
  const at = value.indexOf('@');
  if (at < 1) return '***';
  const name = value.slice(0, at);
  const domain = value.slice(at);
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${'*'.repeat(Math.max(2, name.length - head.length))}${domain}`;
}

module.exports = {
  encrypt,
  decrypt,
  safeEqual,
  maskEmail,
  isConfigured,
  ENVELOPE_VERSION,
};
