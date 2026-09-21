const mongoose = require('mongoose');

// An actual transfer of money to a seller against a settlement batch. The
// Settlement says what is owed; the Payout is the attempt to pay it.
//
// The whole point of this model is IDEMPOTENCY (task §8, §15 Rule 4). A
// payout is created against a unique `idempotencyKey` derived from the
// settlement, so a double-clicked button, a retried request or a network
// failure that the client re-sends can only ever produce ONE payout for that
// settlement. A retry after a genuine FAILED attempt is explicit: it takes a
// new attempt number, so the failed attempt stays on the record.
//
// Bank details are SNAPSHOTTED MASKED at creation time. The full account
// number is never copied here and never leaves the Vendor document (§8, §17).

// RELEASED (added for Razorpay Route seller-settlement automation, sub-task
// 4/11): a held Route transfer whose settlement hold has been released, but
// which Razorpay has not yet confirmed as actually settled to the seller —
// that confirmation is a later webhook sub-task, which will add whatever
// RELEASED -> COMPLETED transition it needs once it exists. It sits strictly
// between PROCESSING (transfer created, held) and COMPLETED (money
// confirmed moved) so a payout is never marked COMPLETED before Razorpay has
// actually said so.
const STATUSES = ['PENDING', 'PROCESSING', 'RELEASED', 'COMPLETED', 'FAILED', 'CANCELLED'];
const METHODS = ['BANK_TRANSFER', 'UPI', 'MANUAL', 'RAZORPAY_ROUTE'];

// Only these moves are legal. A COMPLETED payout is terminal — money has
// left, so it can never be walked back to PENDING; it is corrected with a
// reversing ADJUSTMENT on the ledger instead.
const ALLOWED_TRANSITIONS = Object.freeze({
  PENDING: ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  // RELEASED: the settlementReleaseJob has atomically claimed this payout
  // (PROCESSING -> RELEASED) and asked Razorpay to release the hold.
  // COMPLETED direct from PROCESSING covers the edge case where Razorpay's
  // transfer.processed webhook arrives before settlementReleaseJob's own
  // PROCESSING -> RELEASED claim runs (the job polls on a 30-min cron; the
  // webhook can beat it there) — already allowed pre-sub-task-5 for the
  // manual/legacy payout flow, kept as-is.
  PROCESSING: ['COMPLETED', 'FAILED', 'RELEASED'],
  // If the release job's claim succeeds but the actual Razorpay release call
  // then fails, it rolls back to FAILED (retry-eligible) rather than being
  // stuck RELEASED with no transfer actually released. COMPLETED (added for
  // sub-task 5/11, the route-transfers webhook) is the happy path: Razorpay's
  // transfer.processed webhook confirms the released transfer actually
  // settled to the seller.
  RELEASED: ['FAILED', 'COMPLETED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
});

const auditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const payoutSchema = new mongoose.Schema(
  {
    payoutId: { type: String, required: true, unique: true },

    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', required: true, index: true },

    // Integer paise, like the ledger it posts to.
    amount: {
      type: Number, required: true, min: 0,
      validate: { validator: Number.isInteger, message: 'amount must be an integer number of paise' },
    },
    currency: { type: String, default: 'INR' },

    method: { type: String, enum: METHODS, default: 'BANK_TRANSFER' },

    // Masked snapshot only — "XXXX XXXX 4582". Never the full number.
    bankAccountMasked: { type: String, default: '' },
    bankName: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },

    // Bank/NEFT reference for a completed transfer.
    utr: { type: String, default: null },
    providerReference: { type: String, default: null },

    // Razorpay Route transfer id and the destination linked account it went to.
    razorpayTransferId: { type: String },
    razorpayAccountId: { type: String },

    status: { type: String, enum: STATUSES, default: 'PENDING', index: true },
    failureReason: { type: String, default: '' },
    notes: { type: String, default: '', trim: true },

    // Which retry this is for the settlement. 1 for the first attempt.
    attempt: { type: Number, default: 1, min: 1 },

    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    initiatedByName: { type: String, default: '' },
    processedAt: { type: Date, default: null },

    auditHistory: { type: [auditEntrySchema], default: () => [] },

    // Unique per (settlement, attempt) — see the header. This index is the
    // duplicate-payout guarantee; nothing depends on a read-then-write check.
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true }
);

payoutSchema.index({ idempotencyKey: 1 }, { unique: true });
payoutSchema.index({ vendor: 1, createdAt: -1 });
// Unique per transfer, but only enforced when present — hard-prevents duplicate
// Razorpay Route transfers per payout without rejecting docs that have none yet.
payoutSchema.index({ razorpayTransferId: 1 }, { unique: true, sparse: true });

payoutSchema.statics.canTransition = function canTransition(from, to) {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
};

const Payout = mongoose.model('Payout', payoutSchema);
Payout.STATUSES = STATUSES;
Payout.METHODS = METHODS;
Payout.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;

module.exports = Payout;
