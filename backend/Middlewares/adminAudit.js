const mongoose = require('mongoose');
const AdminAuditLog = require('../Models/AdminAuditLog');

// Mounted once on /admin in app.js, ahead of every admin router, so every
// admin/staff write lands in the audit log without any controller having to
// remember to log itself. It records on 'finish' — by then protectAdmin has
// run and req.admin says who it was, and the status code says whether it
// actually happened.
//
// Reads are not logged (the dashboard alone polls a dozen endpoints); only
// writes, sign-in attempts and downloads/exports, which are how data leaves.

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DOWNLOAD_RE = /\/(download|export)(\/|$)/i;
// POSTs that only compute and write nothing (they need a body, so not a GET).
const READ_ONLY_POST_RE = /\/preview$/i;

const SENSITIVE_KEY_RE = /pass(word)?|token|secret|otp|pin$|cvv|api_?key|private_?key|signature|authorization/i;
const MAX_CHANGES_LENGTH = 2000;

// Trailing path words that are already a verb (POST /orders/:id/cancel), so
// the action reads "orders.cancel" rather than "orders.cancel.create".
const VERB_WORDS = new Set([
  'login', 'logout', 'run', 'sync', 'import', 'export', 'download', 'approve', 'reject',
  'cancel', 'refund', 'retry', 'test', 'send', 'publish', 'unpublish', 'upload', 'trigger',
  'verify', 'reset', 'resend', 'assign', 'unassign', 'close', 'reopen', 'archive', 'restore',
  'suspend', 'activate', 'deactivate', 'block', 'unblock', 'bulk', 'toggle', 'duplicate',
  'pay', 'settle', 'post', 'reverse', 'dispatch', 'ship', 'deliver', 'escalate', 'resolve',
  'forgot-password', 'reset-password', 'change-password',
]);

const METHOD_VERB = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete', GET: 'download' };
const VERB_LABEL = { create: 'Created', update: 'Updated', delete: 'Deleted', download: 'Downloaded' };

function looksLikeId(segment) {
  return (
    /^[0-9a-f]{24}$/i.test(segment) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
    /^\d+$/.test(segment) ||
    // Human-readable references such as KZ-40101-A or TKT-00012.
    (/\d/.test(segment) && /[-_]/.test(segment) && segment.length >= 5)
  );
}

function humanize(word) {
  const spaced = word.replace(/[-_]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// "/admin/orders/66f0…/status" + PATCH → orders.status.update on Orders #66f0…
function describeRoute(method, path) {
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
  if (segments[0] === 'admin') segments.shift();

  let entityId = '';
  const words = [];
  segments.forEach((segment) => {
    if (looksLikeId(segment)) entityId = segment;
    else words.push(segment.toLowerCase());
  });

  const last = words[words.length - 1];
  const verb = last && VERB_WORDS.has(last) ? words.pop() : METHOD_VERB[method] || method.toLowerCase();

  const entityWords = words.length ? words : ['admin'];
  const action = [...entityWords, verb].join('.');
  const entity = entityWords.map(humanize).join(' › ');
  const target = `${entity}${entityId ? ` #${entityId}` : ''}`;

  return {
    action,
    entity,
    entityId,
    description: VERB_LABEL[verb] ? `${VERB_LABEL[verb]} ${target}` : `${humanize(verb)} — ${target}`,
  };
}

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_RE.test(key) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function summariseBody(body) {
  if (!body || typeof body !== 'object' || !Object.keys(body).length) return null;
  let text;
  try {
    text = JSON.stringify(redact(body));
  } catch {
    return null;
  }
  return text.length > MAX_CHANGES_LENGTH ? `${text.slice(0, MAX_CHANGES_LENGTH)}…` : text;
}

function clientIp(req) {
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

function actorRoleLabel(actor) {
  if (!actor) return 'Unauthenticated';
  if (actor.role === 'admin') return 'Super Admin';
  return actor.roleId?.name || 'Staff';
}

const ACCESS_RE = /^\/admin\/(auth|roles|staff)(\/|$)/;
const FINANCE_RE = /^\/admin\/(finance|accounting|accounts|payments|settings)(\/|$)|payout|settlement|refund|commission/;

function classify({ method, path, statusCode, isSignIn }) {
  const failed = statusCode >= 400;
  const category = ACCESS_RE.test(path) ? 'access' : FINANCE_RE.test(path) ? 'finance' : 'general';

  let severity = 'info';
  if (isSignIn && failed) severity = 'critical';
  else if (failed) severity = 'notable';
  else if (method === 'DELETE') severity = 'critical';
  else if (category !== 'general' && !isSignIn && !/\/auth\/(language|profile)$/.test(path)) severity = 'critical';
  else if (DOWNLOAD_RE.test(path)) severity = 'notable';

  return { category, severity };
}

function adminAudit(req, res, next) {
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split('?')[0];
  const isWrite = WRITE_METHODS.has(method) && !(method === 'POST' && READ_ONLY_POST_RE.test(path));
  const isDownload = method === 'GET' && DOWNLOAD_RE.test(path);
  if (!isWrite && !isDownload) return next();

  res.on('finish', () => {
    try {
      const isAuthRoute = path.startsWith('/admin/auth/');
      const actor = req.admin || res.locals.auditActor || null;
      // Anonymous writes that bounced off protectAdmin are noise, not evidence
      // — except on the auth routes, where a failed sign-in is the point.
      if (!actor && !isAuthRoute) return;
      if (mongoose.connection.readyState !== 1) return;

      const { action, entity, entityId, description } = describeRoute(method, path);
      const isSignIn = path === '/admin/auth/login';
      const { category, severity } = classify({ method, path, statusCode: res.statusCode, isSignIn });
      const success = res.statusCode < 400;
      const attemptedEmail = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';

      AdminAuditLog.create({
        actorId: actor?._id || null,
        actorName: actor?.name || attemptedEmail || 'Unknown',
        actorEmail: actor?.email || attemptedEmail,
        actorRole: actorRoleLabel(actor),
        action: success ? action : `${action}.fail`,
        description: success ? description : `${description} — failed (${res.statusCode})`,
        method,
        path,
        entity,
        entityId,
        statusCode: res.statusCode,
        success,
        changes: isSignIn ? null : summariseBody(req.body),
        ip: clientIp(req),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
        severity,
        category,
      }).catch((err) => {
        if (process.env.NODE_ENV !== 'test') console.error('Audit log write failed:', err.message);
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') console.error('Audit log failed:', err.message);
    }
  });

  next();
}

module.exports = { adminAudit, describeRoute };
