const mongoose = require('mongoose');

const TYPES = ['CREDIT', 'DEBIT'];
const SOURCES = ['TOPUP', 'ORDER_PAYMENT', 'ORDER_REFUND'];
const STATUSES = ['SUCCESS', 'FAILED'];

const walletTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    source: { type: String, enum: SOURCES, required: true },
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    status: { type: String, enum: STATUSES, default: 'SUCCESS' },
  },
  { timestamps: true }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
// Guards a repeated top-up verify call (e.g. the client retrying after a
// dropped response) from crediting the wallet twice for the same payment.
walletTransactionSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
WalletTransaction.TYPES = TYPES;
WalletTransaction.SOURCES = SOURCES;
WalletTransaction.STATUSES = STATUSES;

module.exports = WalletTransaction;
