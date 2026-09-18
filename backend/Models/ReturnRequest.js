const mongoose = require('mongoose');

const REQUEST_TYPES = ['REPLACEMENT', 'REFUND'];
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const SELLER_RECOMMENDATIONS = ['APPROVE', 'REJECT'];

// What the seller thinks should happen, and why. Advisory only — the decision
// and the money stay with admin (adminReturnController.decideReturnRequest),
// because approving a REFUND credits the buyer's wallet and a seller must not
// be the judge of a claim against their own product.
//
// The value of capturing it anyway: the seller is the only party who knows
// whether the returned item came back damaged, whether it is even their SKU,
// or whether this buyer has done it four times. Admin was deciding without any
// of that.
const sellerRecommendationSchema = new mongoose.Schema(
  {
    decision: { type: String, enum: SELLER_RECOMMENDATIONS, required: true },
    note: { type: String, default: '', trim: true, maxlength: 1000 },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
    // Null until the seller weighs in; they may also change their mind while
    // the request is still PENDING, in which case this is overwritten.
    sellerRecommendation: { type: sellerRecommendationSchema, default: null },
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
ReturnRequest.SELLER_RECOMMENDATIONS = SELLER_RECOMMENDATIONS;

module.exports = ReturnRequest;
