const mongoose = require('mongoose');

// One row per privileged action taken through the admin panel — who did it,
// when, from where, and what they sent. Written by Middlewares/adminAudit.js,
// never by a controller, so no route can forget to log itself.
//
// Append-only: there is no update or delete endpoint, and the hooks below
// refuse both even from a script, which is what makes this evidence rather
// than a convenience.
const adminAuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Snapshotted, not populated — a renamed or deleted staff account must
    // not rewrite who did something last month.
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true },
    description: { type: String, default: '' },
    method: { type: String, required: true },
    path: { type: String, required: true },
    entity: { type: String, default: '' },
    entityId: { type: String, default: '' },
    statusCode: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    // Redacted, truncated JSON of the request body.
    changes: { type: String, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    severity: { type: String, enum: ['info', 'notable', 'critical'], default: 'info' },
    category: { type: String, enum: ['access', 'finance', 'general'], default: 'general' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ actorId: 1, createdAt: -1 });
adminAuditLogSchema.index({ severity: 1, createdAt: -1 });
adminAuditLogSchema.index({ category: 1, createdAt: -1 });

function refuse() {
  throw new Error('Audit log entries are append-only');
}
[
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
].forEach((op) => adminAuditLogSchema.pre(op, refuse));

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
