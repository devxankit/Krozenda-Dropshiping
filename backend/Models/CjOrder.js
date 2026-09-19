const mongoose = require('mongoose');

// One CJ sub-order created against CJ Dropshipping on behalf of a Krozenda
// order line — master plan §14/§28. Kept entirely separate from Order.js:
// the customer-facing Order is Krozenda's source of truth (master plan's
// final principle), this is bookkeeping for the provider leg of it.
//
// krozendaSubOrderId is the idempotency key (hardening req: unique index
// below). It is Krozenda-generated, deterministic per (order, CJ product),
// and is what cjOrderService checks BEFORE calling CJ's create-order
// endpoint — see that file's createOrder() for why this matters (a network
// timeout after CJ actually created the order must never produce a second
// one on retry).

const cjOrderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    cjProductId: { type: String, required: true },
    cjVariantId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 }, // CJ's cost at order time, not the customer's selling price
  },
  { _id: false }
);

const cjOrderSchema = new mongoose.Schema(
  {
    // krozendaOrderId is the parent Order; krozendaSubOrderId scopes this to
    // one CJ-fulfilled leg of it (a mixed cart can have Admin-CJ, Admin-own
    // and Seller lines in the same parent order — master plan §21).
    krozendaOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    krozendaSubOrderId: { type: String, required: true, unique: true },

    cjOrderId: { type: String, default: null, index: true },
    cjOrderNumber: { type: String, default: '' },

    items: { type: [cjOrderItemSchema], default: [] },

    // Internal statuses only — see cjStatusMapper for the CJ->Krozenda
    // translation. FULFILLMENT_FAILED is distinct from CANCELLED: it means
    // CJ rejected/failed the order AFTER the customer already paid, which is
    // what triggers the automatic refund workflow (hardening req #3), not a
    // routine cancellation.
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'CONFIRMED',
        'PROCESSING',
        'SHIPPED',
        'IN_TRANSIT',
        'DELIVERED',
        'CANCELLED',
        'FULFILLMENT_FAILED',
      ],
      default: 'PENDING_PAYMENT',
    },
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },

    totalCost: { type: Number, default: 0, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },

    lastError: { type: String, default: '' },
    createRequestId: { type: String, default: '' }, // sent to CJ as the idempotency/reference token

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

cjOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CjOrder', cjOrderSchema);
