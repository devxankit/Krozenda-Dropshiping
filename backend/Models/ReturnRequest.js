const mongoose = require('mongoose');

const REQUEST_TYPES = ['REPLACEMENT', 'REFUND'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const returnRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    productImage: { type: String, default: null },

    requestType: { type: String, enum: REQUEST_TYPES, required: true },
    reason: { type: String, required: true, trim: true },
    photos: { type: [String], default: [] },

    status: { type: String, enum: STATUSES, default: 'PENDING' },
    adminNote: { type: String, default: '', trim: true },
    // Refund credited to Wallet on approval of a REFUND request — snapshot of
    // what was actually paid at checkout for this line item.
    refundAmount: { type: Number, default: null, min: 0 },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

returnRequestSchema.index({ user: 1, createdAt: -1 });
// One active (non-terminal) request per order+product at a time.
returnRequestSchema.index(
  { order: 1, product: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } }
);

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
ReturnRequest.REQUEST_TYPES = REQUEST_TYPES;
ReturnRequest.STATUSES = STATUSES;

module.exports = ReturnRequest;
