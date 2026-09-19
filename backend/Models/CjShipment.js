const mongoose = require('mongoose');

// One shipment/tracking record per CJ order — master plan §18. Separate from
// CjOrder because a single CJ order can ship in more than one parcel, and
// because tracking events accumulate over the shipment's life independently
// of the order's own status transitions.

const trackingEventSchema = new mongoose.Schema(
  {
    status: { type: String, default: '' }, // CJ's raw tracking status string, kept as-is for display
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    occurredAt: { type: Date, default: null },
  },
  { _id: false }
);

const cjShipmentSchema = new mongoose.Schema(
  {
    cjOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'CjOrder', required: true, index: true },
    cjOrderId: { type: String, required: true, index: true },

    trackingNumber: { type: String, default: '', index: true },
    carrier: { type: String, default: '' },

    // Krozenda-facing status, mapped the same way order status is (see
    // cjStatusMapper) — never a raw CJ tracking string used for branching.
    status: {
      type: String,
      enum: ['PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RTO'],
      default: 'PROCESSING',
    },

    trackingEvents: { type: [trackingEventSchema], default: [] },

    // Polling fallback needs to know what it hasn't checked recently, same
    // shape as ShippingIntegration's staleness gate for Shiprocket tracking.
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cjShipmentSchema.index({ status: 1, lastSyncedAt: 1 });

module.exports = mongoose.model('CjShipment', cjShipmentSchema);
