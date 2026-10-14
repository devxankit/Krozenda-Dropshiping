const mongoose = require('mongoose');

// Links a Krozenda Product to the external provider that actually fulfils it.
//
// A separate collection rather than fields bolted onto Product: Product,
// Order and checkout stay provider-agnostic, and the provider's own ids live
// in one place. One document per Product.
//
// The mere EXISTENCE of a row is what marks a product externally fulfilled —
// Product.fulfillmentProvider is only a denormalized copy for browse queries.
// services/fulfillment/fulfillmentRouter.js reads both and is the only thing
// that should answer "who fulfils this".
//
// Field names are deliberately provider-neutral (`externalProductId`, not
// `shopifyProductId`). The previous version of this file claimed to be
// provider-agnostic while naming every field `cj*`, which is what made
// swapping the provider a rewrite instead of a config change.

const variantMappingSchema = new mongoose.Schema(
  {
    // _id of the matching entry in Product.variants[] — null for a simple,
    // variant-less product where the mapping is 1:1 with the Product itself.
    krozendaVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // The provider's variant identifier (for Shopify, a ProductVariant GID).
    // Stable and authoritative: variants are reconciled by this, never by
    // position in the array. A positional match sells the wrong item at the
    // wrong price the first time anything reorders the list.
    externalVariantId: { type: String, required: true, trim: true },
    externalSku: { type: String, default: '', trim: true },

    // Shopify addresses stock by inventory item + location, not by variant,
    // so an inventory webhook can only be matched back through these.
    externalInventoryItemId: { type: String, default: '', trim: true },
    externalLocationId: { type: String, default: '', trim: true },

    // The provider's cost and its own retail price at last sync, in the
    // currency named below. The margin report reads providerCost; it is never
    // shown to a buyer.
    providerCost: { type: Number, default: null, min: 0 },
    providerPrice: { type: Number, default: null, min: 0 },
    providerStock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// Who owns each field, per product. Defaults come from
// services/shopify/syncPolicy.js; this is the per-product override for when a
// provider's app takes over a listing's copy.
//
// The rule the whole two-way sync rests on: no field is two-way. Each one
// flows in exactly one direction, so there is never a merge to resolve.
const fieldOwnershipSchema = new mongoose.Schema(
  {
    content: { type: String, enum: ['KROZENDA', 'PROVIDER'], default: 'KROZENDA' },
    price: { type: String, enum: ['KROZENDA', 'PROVIDER'], default: 'KROZENDA' },
    inventory: { type: String, enum: ['KROZENDA', 'PROVIDER'], default: 'PROVIDER' },
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
    provider: { type: String, enum: ['SHOPIFY'], default: 'SHOPIFY' },

    externalProductId: { type: String, required: true, trim: true, index: true },
    externalHandle: { type: String, default: '', trim: true },
    externalStatus: { type: String, enum: ['ACTIVE', 'ARCHIVED', 'DRAFT', ''], default: '' },

    // Which dropshipping app on the Shopify store supplies this product.
    //
    // Several apps feed one store, and Krozenda reads the store rather than
    // the apps — so without this, a stuck order or a margin figure can only
    // ever be attributed to "Shopify", which no-one can act on. Detected at
    // import by services/shopify/supplierResolver.js; UNKNOWN is a real,
    // honest answer rather than a guess.
    externalSupplier: { type: String, default: 'UNKNOWN', trim: true, uppercase: true, index: true },
    // How confident that detection was, so a wrong attribution is traceable
    // to the rule that made it.
    externalSupplierSource: { type: String, enum: ['SKU', 'VENDOR', 'NONE'], default: 'NONE' },
    // The provider's own category, which Dropship India fills in and vFulfill
    // leaves blank. Kept as an import-time hint for picking a Krozenda
    // category, never shown to a buyer.
    externalProductType: { type: String, default: '', trim: true },
    shopDomain: { type: String, default: '', trim: true, lowercase: true },
    currency: { type: String, default: 'INR', trim: true, uppercase: true },
    taxesIncluded: { type: Boolean, default: true },

    variants: { type: [variantMappingSchema], default: [] },

    // Which way this product was created, which decides who owns its stock:
    //   IMPORTED_FROM_SHOPIFY — the provider owns stock. Krozenda mirrors it
    //     and NEVER pushes a quantity: the order Krozenda creates at the
    //     provider is itself the decrement, so pushing one too would
    //     double-count.
    //   CREATED_IN_KROZENDA  — Krozenda owns stock and pushes it up as an
    //     absolute set (never a delta, which drifts permanently against a
    //     concurrent sale on the provider's side).
    origin: {
      type: String,
      enum: ['IMPORTED_FROM_SHOPIFY', 'CREATED_IN_KROZENDA'],
      default: 'IMPORTED_FROM_SHOPIFY',
    },
    inventoryOwner: { type: String, enum: ['SHOPIFY', 'KROZENDA'], default: 'SHOPIFY' },

    fieldOwnership: { type: fieldOwnershipSchema, default: () => ({}) },

    // Outbound sync. Fields the admin has changed that the provider has not
    // been told about yet; the drain job coalesces them, so ten quick edits
    // cost one mutation instead of ten against the rate-limit budget.
    outboundDirtyFields: { type: [String], default: [] },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },

    syncStatus: { type: String, enum: ['IDLE', 'SYNCING', 'FAILED'], default: 'IDLE' },
    lastSyncedAt: { type: Date, default: null },
    lastSyncError: { type: String, default: '' },

    onboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Unique, unlike the CJ-era version: importing is "admin browses and clicks",
// so without this a double-click mints two Krozenda products for one external
// product. The import treats E11000 here as "already imported", not an error.
productFulfillmentMappingSchema.index({ provider: 1, externalProductId: 1 }, { unique: true });

// Inbound webhooks identify a variant by its GID, and an inventory webhook
// only by its inventory item id. Without these two, every push is a
// collection scan — the CJ-era schema never needed them because nothing ever
// pushed anything back.
productFulfillmentMappingSchema.index({ provider: 1, 'variants.externalVariantId': 1 });
productFulfillmentMappingSchema.index({ provider: 1, 'variants.externalInventoryItemId': 1 });

module.exports = mongoose.model('ProductFulfillmentMapping', productFulfillmentMappingSchema);
