const mongoose = require('mongoose');

// Links a Krozenda Product to whichever provider actually fulfils it.
// A separate collection rather than fields bolted onto Product (master plan
// §8): Product/Order/checkout stay provider-agnostic, and adding a future
// provider (Amazon, Delhivery, ...) never touches this schema.
//
// One document per Product. `provider` today is always 'CJ' — Shiprocket
// fulfillment needs no mapping row at all, since it's still Product's
// implicit default (no ownerType/fulfillmentType field was added to Product
// itself; the mere EXISTENCE of a mapping row for a product is what marks it
// CJ-fulfilled). fulfillmentService (Phase 5) checks
// ProductFulfillmentMapping.findOne({ product }) before deciding which
// provider service to call.

const cjVariantMappingSchema = new mongoose.Schema(
  {
    // _id of the matching entry in Product.variants[] — null for a simple,
    // variant-less product where the mapping is 1:1 with the Product itself.
    krozendaVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    cjVariantId: { type: String, required: true, trim: true },
    cjSku: { type: String, default: '', trim: true },
    // CJ's own cost + shipping estimate at onboarding/last sync time, in the
    // currency CJ quoted (see ProductFulfillmentMapping.currency). Pricing
    // engine (Phase 3) reads these to compute the selling price; inventory
    // sync (Phase 4) refreshes them.
    providerCost: { type: Number, default: null, min: 0 },
    providerShippingCost: { type: Number, default: null, min: 0 },
    providerStock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const productFulfillmentMappingSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
      index: true,
    },
    provider: { type: String, enum: ['CJ'], default: 'CJ' },

    cjProductId: { type: String, required: true, trim: true, index: true },
    cjProductName: { type: String, default: '', trim: true },
    cjCategoryId: { type: String, default: '', trim: true },
    warehouseCountryCode: { type: String, default: '', trim: true, uppercase: true },
    currency: { type: String, default: 'USD', trim: true, uppercase: true },
    // CJ's raw numeric saleStatus at onboarding time, kept purely for
    // reference — Product.isActive is decided by Krozenda's own rules, never
    // derived automatically from this number (product-display hardening §26).
    sourceStatus: { type: Number, default: null },

    variants: { type: [cjVariantMappingSchema], default: [] },

    // How Product.price / variant prices were derived — informational, since
    // the actual numbers already live on Product; kept here so re-syncing
    // stock/price knows whether to recompute the selling price automatically.
    pricingMode: { type: String, enum: ['MANUAL', 'AUTOMATIC'], default: 'MANUAL' },
    marginRule: {
      type: new mongoose.Schema(
        {
          type: { type: String, enum: ['FLAT', 'PERCENT'], default: 'PERCENT' },
          value: { type: Number, default: 0, min: 0 },
        },
        { _id: false }
      ),
      default: null,
    },

    syncStatus: { type: String, enum: ['IDLE', 'SYNCING', 'FAILED'], default: 'IDLE' },
    lastSyncedAt: { type: Date, default: null },
    lastSyncError: { type: String, default: '' },

    onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

productFulfillmentMappingSchema.index({ provider: 1, cjProductId: 1 });

module.exports = mongoose.model('ProductFulfillmentMapping', productFulfillmentMappingSchema);
