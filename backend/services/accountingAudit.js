const AccountingAuditLog = require('../Models/AccountingAuditLog');

// Fields that must never reach an audit row, whatever object is handed in.
// Matched case-insensitively against the leaf key name, so `bank.accountNumber`
// is caught as `accountNumber` (task §17/§18).
const REDACTED_KEYS = [
  'accountnumber',
  'account_number',
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'keysecret',
  'key_secret',
  'signature',
  'upiid',
  'upi_id',
  'vpa',
  'cvv',
  'ifsccode',
];

function isRedacted(key) {
  const normalized = String(key).toLowerCase();
  return REDACTED_KEYS.some((banned) => normalized === banned || normalized.endsWith(banned));
}

// Deep copy with the sensitive leaves replaced. Runs over BOTH before and
// after, so a secret cannot be reconstructed by diffing the two.
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return '[deep]';
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry, depth + 1));
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (typeof value.toHexString === 'function') return value.toString();

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = isRedacted(key) ? '[redacted]' : sanitize(entry, depth + 1);
  }
  return out;
}

/**
 * Record one sensitive accounting action. Never throws: an audit write that
 * fails must not roll back the financial action it is describing, so the
 * failure is logged and swallowed. (The action itself is already on the
 * ledger, which is the record that has to be right.)
 *
 * @param {object} options
 * @param {string} options.action     One of AccountingAuditLog.ACTIONS.
 * @param {object} [options.req]      Express request, for the admin and IP.
 * @param {string} options.entityType One of AccountingAuditLog.ENTITY_TYPES.
 * @param {string} options.entityId
 * @param {object} [options.before]   Only the fields that changed.
 * @param {object} [options.after]
 * @param {string} [options.reason]
 */
async function recordAudit({ action, req, entityType, entityId, before = null, after = null, reason = '' }) {
  try {
    const admin = req?.admin || null;
    await AccountingAuditLog.create({
      action,
      admin: admin?._id || null,
      adminName: admin?.name || '',
      adminEmail: admin?.email || '',
      entityType,
      entityId: String(entityId),
      before: sanitize(before),
      after: sanitize(after),
      reason: reason || '',
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || '',
    });
  } catch (err) {
    console.error('Accounting audit write failed', { action, entityType, entityId, error: err.message });
  }
}

module.exports = { recordAudit, sanitize };
