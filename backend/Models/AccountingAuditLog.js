const mongoose = require('mongoose');

// Who did what to the money, and what it looked like before and after
// (task §18). Append-only: there is no update or delete path anywhere in the
// accounting module, because an audit trail that can be edited is not one.
//
// `before`/`after` hold only the fields an action actually changed, and the
// writer (services/accountingAudit.js) strips anything sensitive before it
// gets here — a bank account number, a gateway secret or a token must never
// be readable from an audit row.

const ACTIONS = [
  'COMMISSION_RULE_CREATED',
  'COMMISSION_RULE_UPDATED',
  'COMMISSION_RULE_STATUS_CHANGED',
  'SETTLEMENT_GENERATED',
  'SETTLEMENT_HELD',
  'SETTLEMENT_RELEASED',
  'PAYOUT_INITIATED',
  'PAYOUT_COMPLETED',
  'PAYOUT_FAILED',
  'PAYOUT_CANCELLED',
  'REFUND_APPROVED',
  'REFUND_CANCELLED',
  'MANUAL_ADJUSTMENT_CREATED',
  'COD_REMITTANCE_RECORDED',
  'ACCOUNTING_CONFIG_UPDATED',
];

const ENTITY_TYPES = [
  'CommissionRule',
  'Settlement',
  'Payout',
  'ReturnRequest',
  'AccountingTransaction',
  'AccountingConfig',
  'Order',
];

const accountingAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ACTIONS, required: true, index: true },

    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Snapshotted so the trail still reads correctly after a staff account is
    // renamed or deactivated.
    adminName: { type: String, default: '' },
    adminEmail: { type: String, default: '' },

    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId: { type: String, required: true, index: true },

    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },

    reason: { type: String, default: '', trim: true },
    // Present only where the platform already has it on the request.
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

accountingAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
accountingAuditLogSchema.index({ createdAt: -1 });

const AccountingAuditLog = mongoose.model('AccountingAuditLog', accountingAuditLogSchema);
AccountingAuditLog.ACTIONS = ACTIONS;
AccountingAuditLog.ENTITY_TYPES = ENTITY_TYPES;

module.exports = AccountingAuditLog;
