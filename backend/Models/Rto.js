const mongoose = require('mongoose');

// Return-To-Origin: a shipment that never reached the buyer and came back to
// the seller. There's no live courier integration on this platform (see
// Order.items[].trackingNumber comments), so an RTO is raised manually by an
// admin against a SHIPPED item rather than pushed by a courier webhook.
const REASONS = ['undelivered', 'address_failure', 'customer_unreachable', 'refused'];
const COST_BEARERS = ['platform', 'vendor', 'buyer'];

const rtoSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Which variant came back, copied from the order line. Restocking has to
    // credit the variant that was actually shipped — crediting the parent
    // instead leaves that colour short for good while the parent count drifts
    // up. Null on a simple product and on every RTO raised before variants.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    awb: { type: String, default: '' },
    reason: { type: String, enum: REASONS, required: true },
    costBearer: { type: String, enum: COST_BEARERS, default: 'platform' },
    shippingCost: { type: Number, default: 0 },
    orderValue: { type: Number, required: true },
    settlementReversed: { type: Boolean, default: false },
    stockRestored: { type: Boolean, default: false },
    initiatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Rto = mongoose.model('Rto', rtoSchema);
Rto.REASONS = REASONS;
Rto.COST_BEARERS = COST_BEARERS;

module.exports = Rto;
