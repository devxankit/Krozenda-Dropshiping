const mongoose = require('mongoose');

// Accounts MVP — a minimal, standalone record of money actually paid out to a
// vendor. Deliberately separate from the existing Settlement/Payout
// accounting system (backend/Models/Payout.js etc): this is not a
// replacement for it, just a simple log an admin can add entries to by hand.
const METHODS = ['BANK_TRANSFER', 'UPI', 'OTHER'];

const vendorPayoutSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    method: { type: String, enum: METHODS, default: 'OTHER' },
    note: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

vendorPayoutSchema.index({ vendor: 1, paidAt: -1 });

const VendorPayout = mongoose.model('VendorPayout', vendorPayoutSchema);
VendorPayout.METHODS = METHODS;

module.exports = VendorPayout;
