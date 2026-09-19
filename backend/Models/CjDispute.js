const mongoose = require('mongoose');

// One CJ-side dispute per CJ order — master plan §21/§22. This tracks CJ's
// half of a return: the recovery Krozenda pursues FROM CJ. The customer's
// own refund (Razorpay, via the existing return/refund flow) is a separate
// transaction and is intentionally not touched or duplicated here — see
// the file-level note in cjDisputeService.js.

const cjDisputeSchema = new mongoose.Schema(
  {
    cjOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'CjOrder', required: true, index: true },
    cjOrderId: { type: String, required: true, index: true },
    // Krozenda's own ReturnRequest that triggered this, if any — a dispute
    // can also be opened directly by admin (damaged-on-arrival reported by
    // CJ itself) without a customer return existing yet.
    returnRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnRequest', default: null },

    cjDisputeId: { type: String, default: null, index: true },
    reason: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    evidenceImages: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['CREATED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'CREATED',
    },

    // What CJ is expected to (or did) recover to the Krozenda account —
    // distinct from customerRefundAmount, which is what Krozenda pays the
    // customer via Razorpay. These are never assumed equal (master plan §22).
    requestedRecoveryAmount: { type: Number, default: 0, min: 0 },
    approvedRecoveryAmount: { type: Number, default: null, min: 0 },
    resolution: { type: String, default: '', trim: true },

    lastError: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

cjDisputeSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CjDispute', cjDisputeSchema);
