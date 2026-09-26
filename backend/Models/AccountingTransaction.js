const mongoose = require('mongoose');

// The marketplace's financial ledger: one immutable row per money event,
// always attributed to the seller who actually earned or owed it. This is the
// single source of truth the seller ledger, the settlement engine and every
// report are derived FROM — none of them keep their own running totals, so
// there is nothing that can drift out of agreement with it.
//
// Two rules are enforced by the schema itself rather than by convention:
//
//  1. AMOUNTS ARE INTEGER PAISE. Not rupees, not floats. `credit` and `debit`
//     are validated as integers so a fractional paise cannot be written at
//     all (task §7/§8).
//
//  2. EVERY ROW IS IDEMPOTENT. `eventKey` is a unique, deterministic
//     description of the event ("COMMISSION:<order>:<product>:<vendor>"), so
//     a retried webhook, a double-clicked button or the read-time reconciler
//     re-posting the same event is a duplicate-key no-op rather than a second
//     helping of money. This is what makes posting safely repeatable, and is
//     how tasks §15 Rule 4 and Rule 5 are actually guaranteed.
//
// Rows are NEVER updated to change an amount and NEVER deleted. A refund,
// a reversal or a correction is a new row pointing back at the original via
// `reversalOf` (task §15 Rule 1/2/3).

const TYPES = [
  'SALE',
  'COMMISSION',
  'PAYMENT_GATEWAY_FEE',
  'SHIPPING_CHARGE',
  // Buyer-paid platform fee (Order.platformFee). Platform revenue only.
  'PLATFORM_FEE',
  'REFUND',
  'REFUND_REVERSAL',
  'PAYOUT',
  'ADJUSTMENT',
];

// Which side of the SELLER's account the row moves. CREDIT increases what the
// platform owes the seller, DEBIT decreases it.
const DIRECTIONS = ['CREDIT', 'DEBIT'];

const STATUSES = ['PENDING', 'COMPLETED', 'REVERSED', 'FAILED'];

const REFERENCE_TYPES = ['ORDER', 'ORDER_ITEM', 'RETURN_REQUEST', 'SETTLEMENT', 'PAYOUT', 'MANUAL'];

const accountingTransactionSchema = new mongoose.Schema(
  {
    // Human-facing identifier (TXN-00000001). Assigned by the counter in
    // services/accountingSequence.js, never by the caller.
    transactionId: { type: String, required: true, unique: true },

    type: { type: String, enum: TYPES, required: true, index: true },
    direction: { type: String, enum: DIRECTIONS, required: true },

    // --- what this row is about ------------------------------------------
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    // The order line, where the event is line-level. Snapshotted as the
    // product id because Order.items has no _id of its own (see Order.js).
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },

    settlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null, index: true },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null },
    returnRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },

    // Gateway payment id for an online capture; null for COD/wallet. Kept so
    // a ledger row can always be traced back to the money that moved.
    paymentReference: { type: String, default: null },

    // --- the money (INTEGER PAISE) ---------------------------------------
    credit: {
      type: Number, default: 0, min: 0,
      validate: { validator: Number.isInteger, message: 'credit must be an integer number of paise' },
    },
    debit: {
      type: Number, default: 0, min: 0,
      validate: { validator: Number.isInteger, message: 'debit must be an integer number of paise' },
    },
    // Always credit + debit; exactly one of the two is non-zero. Stored
    // rather than derived so the list can sort and sum on magnitude.
    amount: {
      type: Number, required: true, min: 0,
      validate: { validator: Number.isInteger, message: 'amount must be an integer number of paise' },
    },
    currency: { type: String, default: 'INR' },

    status: { type: String, enum: STATUSES, default: 'COMPLETED', index: true },

    referenceType: { type: String, enum: REFERENCE_TYPES, default: 'ORDER' },
    referenceId: { type: String, default: null },

    // The row this one reverses. A REFUND points at the SALE it claws back, a
    // REFUND_REVERSAL at the COMMISSION it returns to the seller.
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountingTransaction', default: null },

    description: { type: String, default: '', trim: true },
    // Working shown for the row: rate applied, base it was applied to,
    // discount attributed, etc. Read-only context for the detail view.
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    // Deterministic identity of the underlying event — see the header.
    eventKey: { type: String, required: true },

    // Null for anything the posting engine raised on its own; set for an
    // admin-initiated adjustment or payout.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// THE idempotency guarantee. Every posting path relies on this index
// rejecting a repeat rather than on a read-then-write check that can race.
accountingTransactionSchema.index({ eventKey: 1 }, { unique: true });

// Seller ledger: every row for one seller, oldest first, for the running
// balance. Also serves the per-seller payable aggregations.
accountingTransactionSchema.index({ vendor: 1, createdAt: 1 });
accountingTransactionSchema.index({ order: 1, vendor: 1 });
accountingTransactionSchema.index({ type: 1, createdAt: -1 });
accountingTransactionSchema.index({ createdAt: -1 });

// A row is written once and never rewritten. Guarding the money fields here
// means even a future caller that reaches for findOneAndUpdate cannot quietly
// restate history (task §15 Rule 2) — it has to post a reversal instead.
const FROZEN_PATHS = ['credit', 'debit', 'amount', 'type', 'direction', 'vendor', 'order', 'eventKey'];
accountingTransactionSchema.pre('save', function freezeAmounts() {
  if (this.isNew) return;
  const changed = FROZEN_PATHS.filter((path) => this.isModified(path));
  if (changed.length > 0) {
    throw new Error(
      `Accounting transactions are immutable — post a reversal instead of editing ${changed.join(', ')}`
    );
  }
});

const AccountingTransaction = mongoose.model('AccountingTransaction', accountingTransactionSchema);
AccountingTransaction.TYPES = TYPES;
AccountingTransaction.DIRECTIONS = DIRECTIONS;
AccountingTransaction.STATUSES = STATUSES;
AccountingTransaction.REFERENCE_TYPES = REFERENCE_TYPES;

module.exports = AccountingTransaction;
