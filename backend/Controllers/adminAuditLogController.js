const mongoose = require('mongoose');
const AdminAuditLog = require('../Models/AdminAuditLog');

const TAB_FILTERS = {
  all: {},
  critical: { severity: 'critical' },
  finance: { category: 'finance' },
  access: { category: 'access' },
  failed: { success: false },
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "24 Sep 2026, 14:22:05" in IST — the whole platform reads in India time.
function formatWhen(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function serialize(log) {
  return {
    id: String(log._id),
    at: formatWhen(log.createdAt),
    createdAt: new Date(log.createdAt).toISOString(),
    actor: log.actorName || 'Unknown',
    actorEmail: log.actorEmail || '',
    actorRole: log.actorRole || '',
    action: log.action,
    description: log.description || '',
    method: log.method,
    path: log.path,
    entity: log.entity || '—',
    entityId: log.entityId || '—',
    statusCode: log.statusCode,
    success: log.success,
    ip: log.ip || '—',
    before: null,
    after: log.changes || null,
    severity: log.severity,
  };
}

// GET /admin/system/audit-logs
async function listAuditLogs(req, res) {
  const { tab = 'all', search, severity, actorId, method, from, to, page, rowsPerPage } = req.query;

  const filter = { ...(TAB_FILTERS[tab] || TAB_FILTERS.all) };
  if (['info', 'notable', 'critical'].includes(severity)) filter.severity = severity;
  if (['POST', 'PUT', 'PATCH', 'DELETE', 'GET'].includes(method)) filter.method = method;
  if (actorId && mongoose.isValidObjectId(actorId)) filter.actorId = actorId;
  if (from || to) {
    filter.createdAt = {};
    if (from && !Number.isNaN(Date.parse(from))) filter.createdAt.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) filter.createdAt.$lte = new Date(to);
  }
  if (typeof search === 'string' && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [
      { actorName: regex },
      { actorEmail: regex },
      { action: regex },
      { description: regex },
      { entity: regex },
      { entityId: regex },
      { path: regex },
      { ip: regex },
    ];
  }

  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(rowsPerPage, 10) || 25));

  const [total, docs, ...counts] = await Promise.all([
    AdminAuditLog.countDocuments(filter),
    AdminAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * size)
      .limit(size)
      .lean(),
    ...Object.values(TAB_FILTERS).map((f) => AdminAuditLog.countDocuments(f)),
  ]);

  const tabCounts = Object.fromEntries(Object.keys(TAB_FILTERS).map((key, i) => [key, counts[i]]));

  res.json({
    success: true,
    data: {
      items: docs.map(serialize),
      page: p,
      rowsPerPage: size,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / size)),
      tabCounts,
    },
  });
}

module.exports = { listAuditLogs };
