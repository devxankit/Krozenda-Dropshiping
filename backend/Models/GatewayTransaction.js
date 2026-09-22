const mongoose = require('mongoose');

// Accounts MVP — a minimal, standalone log of money settling into (or being
// refunded out of) our payment gateway account against a specific order.
// Deliberately separate from the existing accounting system's ledger models;
// this is just a simple record an admin adds by hand.
const TYPES = ['SETTLEMENT', 'REFUND'];

const gatewayTransactionSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    type: { type: String, enum: TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    gateway: { type: String, default: 'RAZORPAY' },
    referenceId: { type: String, default: '', trim: true },
    occurredAt: { type: Date, default: Date.now },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

gatewayTransactionSchema.index({ order: 1, occurredAt: -1 });
gatewayTransactionSchema.index({ type: 1, occurredAt: -1 });

const GatewayTransaction = mongoose.model('GatewayTransaction', gatewayTransactionSchema);
GatewayTransaction.TYPES = TYPES;

module.exports = GatewayTransaction;
