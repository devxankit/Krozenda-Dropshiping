const mongoose = require('mongoose');

// A payout batch for one vendor, covering every delivered order line that
// became eligible (past the hold window, not already claimed by another
// batch) since their last settlement.
//
// Generation now lives in ONE place — services/settlementService.js — which
// both the Accounting module and the older Finance screens call, so a line
// can never be claimed twice by two different generators (task §15 Rule 5).
//
// Statuses: the first three are the vocabulary the older Finance screens were
// built on and are kept so existing batches and their approve/retry flow
// still read correctly; the rest are the Accounting module's lifecycle
// (task §7). ELIGIBLE is the accounting equivalent of AWAITING_APPROVAL, and
// COMPLETED of SETTLED — adminFinanceController maps both onto the same
// outward status strings.
//
// CANCELLED replaces what used to be a hard delete of a rejected draft:
// financial records are never destroyed (task §15 Rule 1), and the claiming
// logic simply ignores CANCELLED batches so their lines become eligible
// again exactly as they did before.
const STATUSES = [
  'AWAITING_APPROVAL',
  'SETTLED',
  'FAILED',
  'PENDING',
  'ELIGIBLE',
  'PROCESSING',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
];

// Batches in these states own their lines. A line claimed by one of them is
// not available to a new batch; a line in a CANCELLED batch is.
const CLAIMING_STATUSES = [
  'AWAITING_APPROVAL',
  'SETTLED',
  'FAILED',
  'PENDING',
  'ELIGIBLE',
  'PROCESSING',
  'COMPLETED',
  'ON_HOLD',
];

// Money has actually left the platform for these.
const PAID_STATUSES = ['SETTLED', 'COMPLETED'];

const settlementItemSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    // Rupees, for continuity with the batches written before the Accounting
    // module existed and with the older Finance screens that read them.
    grossAmount: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    deliveredAt: { type: Date, required: true },

    // --- accounting additions --------------------------------------------
    // Gateway/shipping fees and refunds attributed to this line, so the batch
    // shows its own working rather than only a net figure.
    feeAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    adjustmentAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: null },
  },
  { _id: false }
);

const settlementSchema = new mongoose.Schema(
  {
    // Human-facing identifier (STL-00000001). Null on batches created before
    // the Accounting module; the sparse unique index below allows that.
    settlementId: { type: String, default: null },

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

    // --- accounting additions --------------------------------------------
    // The window of deliveries this batch covers, for the period column and
    // the settlement report.
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },

    // Integer-paise mirrors of the rupee figures above, plus the components
    // the older schema had nowhere to put. These are what the Accounting
    // module reads and reports on; the rupee fields stay for the legacy
    // screens. Both are written from the same computation, so they agree.
    grossPaise: { type: Number, default: 0 },
    commissionPaise: { type: Number, default: 0 },
    feesPaise: { type: Number, default: 0 },
    refundsPaise: { type: Number, default: 0 },
    adjustmentsPaise: { type: Number, default: 0 },
    netPayablePaise: { type: Number, default: 0 },

    eligibleAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null },
    holdReason: { type: String, default: '' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

settlementSchema.index({ vendor: 1, status: 1, createdAt: -1 });
settlementSchema.index({ settlementId: 1 }, { unique: true, sparse: true });
settlementSchema.index({ status: 1, createdAt: -1 });

const Settlement = mongoose.model('Settlement', settlementSchema);
Settlement.STATUSES = STATUSES;
Settlement.CLAIMING_STATUSES = CLAIMING_STATUSES;
Settlement.PAID_STATUSES = PAID_STATUSES;

module.exports = Settlement;
