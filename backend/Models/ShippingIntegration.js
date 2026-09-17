const mongoose = require('mongoose');
const { SHIPPING_PROVIDERS, SHIPPING_ACCOUNT_TYPES, INTEGRATION_STATUSES } = require('../Config/shipping');

// One carrier account, belonging either to a seller or to the platform.
//
// This is the row shippingAccountResolver hands to the carrier client, and the
// row a Shipment permanently points at. Keeping it as its own collection
// (rather than fields on Vendor) is what makes the following possible:
//
//   * a seller disconnecting their account without destroying the history of
//     shipments that went through it (task §12)
//   * a second provider later, without reshaping Vendor
//   * querying "every integration that failed its last test" for an admin
//     health screen
//
// SECURITY: `credentials.encryptedPassword` is an AES-256-GCM envelope from
// utils/secretBox. It is `select: false`, so it is excluded from every query
// unless a caller explicitly asks — which only the auth service does. Nothing
// in this document is ever safe to send to a client; use toSafeJSON().

const credentialsSchema = new mongoose.Schema(
  {
    // Stored in clear because it is an identifier, not a secret, and support
    // needs to be able to tell two accounts apart.
    email: { type: String, trim: true, lowercase: true, default: '' },
    // AES-256-GCM envelope. Never logged, never returned, never compared.
    encryptedPassword: { type: String, default: '', select: false },
    // Bumped whenever the encryption key rotates, so a re-encryption pass can
    // find the records it still has to migrate.
    credentialVersion: { type: Number, default: 1 },
  },
  { _id: false }
);

const shippingIntegrationSchema = new mongoose.Schema(
  {
    // null = the platform's own account. A seller's account carries their id.
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    accountType: { type: String, enum: SHIPPING_ACCOUNT_TYPES, required: true },
    provider: { type: String, enum: SHIPPING_PROVIDERS, required: true, default: 'SHIPROCKET' },

    status: { type: String, enum: INTEGRATION_STATUSES, default: 'CONFIGURATION_REQUIRED' },

    credentials: { type: credentialsSchema, default: () => ({}) },

    // --- connection health (task §11) --------------------------------------
    lastTestedAt: { type: Date, default: null },
    lastSuccessfulAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    // A SAFE message only — "Invalid email or password", never the carrier's
    // raw response, never anything echoing the credential.
    failureReason: { type: String, default: '', trim: true },
    consecutiveFailures: { type: Number, default: 0, min: 0 },

    // Non-sensitive carrier account facts worth caching for display, e.g. the
    // company name Shiprocket reports back at login. Never tokens.
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    // Soft state. A disconnected integration keeps its row so historical
    // shipments still resolve their account snapshot (task §12, §46).
    isActive: { type: Boolean, default: true },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One ACTIVE integration per (vendor, provider) — task §45's uniqueness rule.
// Partial so that any number of DISCONNECTED historical rows may coexist.
shippingIntegrationSchema.index(
  { vendor: 1, provider: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
// The platform row is the one with vendor: null; this makes resolving it a
// single indexed lookup.
shippingIntegrationSchema.index({ accountType: 1, provider: 1, isActive: 1 });
// Admin health screen: "integrations currently failing".
shippingIntegrationSchema.index({ status: 1, lastFailureAt: -1 });

// The ONLY shape of this document that may cross the API boundary.
// Deliberately constructs a fresh object rather than deleting fields off a
// clone, so a field added to the schema later is excluded by default instead
// of leaking until someone remembers to blocklist it.
shippingIntegrationSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    provider: this.provider,
    accountType: this.accountType,
    status: this.status,
    // Identifier only, in full. This shape is for the account's OWNER — a
    // seller looking at their own connection needs to see which address they
    // connected. It is NOT the admin shape: task §18 says an admin screen
    // shows "Seller Own Account", not the seller's email, so
    // adminShippingController masks it with secretBox.maskEmail() rather than
    // reusing this method.
    email: this.credentials?.email || '',
    isActive: this.isActive,
    lastTestedAt: this.lastTestedAt,
    lastSuccessfulAt: this.lastSuccessfulAt,
    lastFailureAt: this.lastFailureAt,
    failureReason: this.failureReason || '',
    disconnectedAt: this.disconnectedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('ShippingIntegration', shippingIntegrationSchema);
