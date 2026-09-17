const mongoose = require('mongoose');

// Platform-wide shipping POLICY as one editable singleton, following the same
// pattern as AccountingConfig: the rules that decide which account ships an
// order, and how a package is measured, are an admin record with an audit
// trail — not constants buried in the service layer (task §19, §16).
//
// The three fields that actually decide behaviour are `provider`,
// `sellerOwnAccountEnabled` and `platformFallbackEnabled`; shippingAccountResolver
// reads nothing else to pick an account.

const COURIER_SELECTION_STRATEGIES = [
  // Whatever Shiprocket ranks first in its serviceability response.
  'RECOMMENDED',
  // Cheapest serviceable courier.
  'CHEAPEST',
  // Fastest by estimated delivery days.
  'FASTEST',
  // Seller/admin picks per shipment; no automatic choice is made.
  'MANUAL',
];

const shippingSettingsSchema = new mongoose.Schema(
  {
    // Enforces the singleton: a second document cannot be inserted.
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    // --- master switch ----------------------------------------------------
    // Off means no shipment may be created through any carrier. Existing
    // shipments stay readable and trackable.
    shippingEnabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['SHIPROCKET'], default: 'SHIPROCKET' },

    // --- account routing (task §16) ---------------------------------------
    // May a seller ship on their OWN carrier account?
    sellerOwnAccountEnabled: { type: Boolean, default: true },
    // When a seller has no working account of their own, may the platform's
    // account be used on their behalf? Off means shipment creation is BLOCKED
    // with a configuration error rather than quietly billed to the platform.
    platformFallbackEnabled: { type: Boolean, default: true },

    // --- courier selection -------------------------------------------------
    courierSelectionStrategy: {
      type: String,
      enum: COURIER_SELECTION_STRATEGIES,
      default: 'RECOMMENDED',
    },
    // Couriers to never auto-select (by Shiprocket courier_company_id). A
    // manual selection can still override.
    blockedCourierIds: { type: [Number], default: [] },

    // --- packaging ---------------------------------------------------------
    // Volumetric weight = (L x B x H in cm) / divisor, and the carrier is
    // charged on max(actual, volumetric). Shiprocket documents 5000 as the
    // usual constant but is explicit that it varies by carrier — which is
    // exactly why this is a setting and not a hardcoded 5000.
    volumetricDivisor: { type: Number, default: 5000, min: 1 },
    // Used when a product carries no dimensions and the seller has set no
    // default of their own (Decision B's fallback chain).
    defaultPackage: {
      type: new mongoose.Schema(
        {
          lengthCm: { type: Number, default: 15, min: 0.5 },
          breadthCm: { type: Number, default: 15, min: 0.5 },
          heightCm: { type: Number, default: 10, min: 0.5 },
          weightKg: { type: Number, default: 0.5, min: 0.01 },
        },
        { _id: false }
      ),
      default: () => ({}),
    },

    // --- COD ---------------------------------------------------------------
    codEnabled: { type: Boolean, default: true },

    // --- tracking sync (task §24) ------------------------------------------
    // Webhooks are the primary mechanism; this is the fallback poll. Only
    // shipments in POLLABLE_STATUSES that have not been updated within the
    // staleness window are ever fetched.
    trackingPollEnabled: { type: Boolean, default: true },
    trackingPollCron: { type: String, default: '*/30 * * * *' },
    trackingStaleAfterMinutes: { type: Number, default: 180, min: 15 },
    trackingPollBatchSize: { type: Number, default: 50, min: 1, max: 500 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Reads the singleton, creating it with defaults on first use. Every caller
// goes through this rather than findOne, so the document is guaranteed to
// exist and the defaults above are the real starting policy.
shippingSettingsSchema.statics.getSettings = async function getSettings() {
  const existing = await this.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await this.create({ key: 'GLOBAL' });
  } catch (err) {
    // Two concurrent first-requests can both miss the read; the unique index
    // turns the loser into a duplicate-key error rather than a second row.
    if (err.code === 11000) return this.findOne({ key: 'GLOBAL' });
    throw err;
  }
};

const ShippingSettings = mongoose.model('ShippingSettings', shippingSettingsSchema);
ShippingSettings.COURIER_SELECTION_STRATEGIES = COURIER_SELECTION_STRATEGIES;

module.exports = ShippingSettings;
