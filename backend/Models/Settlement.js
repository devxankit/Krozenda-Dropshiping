const mongoose = require('mongoose');

// A payout batch for one vendor, covering every delivered order line that
// became eligible (past the hold window, not already in another batch)
// since their last settlement. Drafted automatically the first time an admin
// opens Settlements (see adminFinanceController.listSettlements) — there is
// no bank/payout gateway wired up, so "approve" just records the decision;
// no money actually leaves the platform.
const STATUSES = ['AWAITING_APPROVAL', 'SETTLED', 'FAILED'];

const settlementItemSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    grossAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    deliveredAt: { type: Date, required: true },
  },
  { _id: false }
);

const settlementSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    items: { type: [settlementItemSchema], required: true, validate: (v) => v.length > 0 },
    grossAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    tdsAmount: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netAmount: { type: Number, required: true },
    mode: { type: String, default: 'BANK_TRANSFER' },
    utr: { type: String, default: null },
    status: { type: String, enum: STATUSES, default: 'AWAITING_APPROVAL' },
    scheduledFor: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

settlementSchema.index({ vendor: 1, status: 1, createdAt: -1 });

const Settlement = mongoose.model('Settlement', settlementSchema);
Settlement.STATUSES = STATUSES;

module.exports = Settlement;
