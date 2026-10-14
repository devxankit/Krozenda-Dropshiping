const mongoose = require('mongoose');

// The Shopify connection, as one editable singleton — same pattern as
// ShippingSettings / PaymentSettings / CatalogSettings.
//
// Credentials are stored encrypted (utils/secretBox.js, AES-256-GCM) and are
// `select: false`, so an ordinary read of this document can never put them on
// the wire. getSettingsWithSecrets() is the only way to see them, and callers
// should hold the plaintext no longer than one request.
//
// WHAT LIVES HERE AND WHAT DOES NOT. This holds the CONNECTION: credentials,
// token, health, and the shop's own shape (currency, location). It does NOT
// hold the storefront kill-switch — whether buyers can see externally
// fulfilled products is a catalog decision and lives on CatalogSettings, so it
// survives disconnecting, reconnecting or replacing the provider.

const shopifySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },

    shopDomain: { type: String, default: '', trim: true, lowercase: true },

    // What Shopify calls the shop, which is not always the host the app was
    // installed on. Recorded for diagnosis; never used to make requests.
    canonicalDomain: { type: String, default: '', trim: true, lowercase: true },

    // Dev Dashboard app credentials. Shopify stopped issuing the long-lived
    // `shpat_` tokens to newly created in-admin custom apps on 2026-01-01, so
    // there is no permanent token to store: the client id and secret are
    // exchanged for a 24-hour token via the client credentials grant.
    encryptedClientId: { type: String, default: '', select: false },
    encryptedClientSecret: { type: String, default: '', select: false },

    // The current access token and its expiry. Short-lived by design —
    // shopifyAuthService refreshes it under a single-flight lock.
    encryptedAccessToken: { type: String, default: '', select: false },
    accessTokenExpiresAt: { type: Date, default: null },

    // Granted scopes as Shopify reports them at token time, so a missing scope
    // is diagnosed from the connection screen instead of from a 403 three
    // layers down in a background job.
    grantedScopes: { type: [String], default: [] },

    apiVersion: { type: String, default: '2026-10', trim: true },

    // The shop's own shape, read once at connect and refreshed on test.
    // Cached because pricing and tax maths need them on every import, and
    // because a currency that is not INR changes the price-push arithmetic.
    shopCurrency: { type: String, default: '', trim: true, uppercase: true },
    shopTaxesIncluded: { type: Boolean, default: null },
    primaryLocationId: { type: String, default: '', trim: true },
    primaryLocationName: { type: String, default: '', trim: true },

    // Whether Shopify actually returns buyer name/phone/address, or redacts
    // them. Shopify reports protected-data problems as NULL FIELDS rather than
    // an error, so this is probed explicitly at connect time: an integration
    // that silently pushes orders with no address would look healthy right up
    // until nothing could be delivered.
    protectedCustomerDataOk: { type: Boolean, default: null },
    protectedCustomerDataCheckedAt: { type: Date, default: null },

    // Pricing. MIRROR keeps Shopify's own retail price, which is the right
    // default: the provider's app sets a sell price the merchant is expected
    // to honour, and marking it up silently would put Krozenda out of step
    // with every other channel the same product is listed on.
    pricingMode: { type: String, enum: ['MIRROR', 'MARKUP'], default: 'MIRROR' },
    markupType: { type: String, enum: ['PERCENT', 'FLAT'], default: 'PERCENT' },
    markupValue: { type: Number, default: 0, min: 0 },
    priceRounding: { type: String, enum: ['NONE', 'ROUND', 'NINE_ENDING'], default: 'NONE' },

    // The category an import falls back to when the admin does not pick one.
    // Null by design: Krozenda requires a category, and inventing one would
    // bury imported products somewhere nobody looks.
    defaultCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    // Delivery charge for externally fulfilled lines. The provider ships
    // them, so no carrier can quote them — these rules are the only source,
    // and `configured` must be set deliberately before anything can be sold.
    shippingRules: {
      type: new mongoose.Schema(
        {
          configured: { type: Boolean, default: false },
          mode: {
            type: String,
            enum: ['FLAT_PER_ORDER', 'PER_ITEM', 'FLAT_PLUS_PER_ITEM', 'FREE'],
            default: 'FLAT_PER_ORDER',
          },
          flatAmount: { type: Number, default: 0, min: 0 },
          perItemAmount: { type: Number, default: 0, min: 0 },
          freeAboveCartValue: { type: Number, default: 0, min: 0 },
          estimatedDeliveryDays: { type: Number, default: 7, min: 1 },
          label: { type: String, default: 'Standard delivery' },
        },
        { _id: false }
      ),
      default: () => ({}),
    },

    // How long a buyer may cancel before the order is sent to the provider.
    // Inside it cancelling is free: nothing has been ordered from anyone, so
    // there is nothing to unwind. Zero sends immediately.
    orderPushGraceMinutes: { type: Number, default: 15, min: 0 },

    // Create Shopify orders flagged as TEST. For verifying the whole flow
    // without a supplier actually shipping anything.
    pushAsTestOrders: { type: Boolean, default: false },

    webhookCallbackUrl: { type: String, default: '' },
    webhookRegisteredAt: { type: Date, default: null },
    webhookTopics: { type: [String], default: [] },

    status: {
      type: String,
      enum: ['DISCONNECTED', 'CONNECTED', 'FAILED'],
      default: 'DISCONNECTED',
    },
    lastConnectionCheckAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    failureReason: { type: String, default: '' },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

shopifySettingsSchema.statics.getSettings = async function getSettings() {
  const existing = await this.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await this.create({ key: 'GLOBAL' });
  } catch (err) {
    if (err.code === 11000) return this.findOne({ key: 'GLOBAL' });
    throw err;
  }
};

shopifySettingsSchema.statics.getSettingsWithSecrets = async function getSettingsWithSecrets() {
  await this.getSettings();
  return this.findOne({ key: 'GLOBAL' }).select(
    '+encryptedClientId +encryptedClientSecret +encryptedAccessToken'
  );
};

// The only shape allowed to cross the API boundary. An allowlist, not a
// denylist: a field added above is invisible to the admin screen until it is
// named here, which is the safe direction for a document holding credentials.
shopifySettingsSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    shopDomain: this.shopDomain,
    canonicalDomain: this.canonicalDomain,
    apiVersion: this.apiVersion,
    status: this.status,
    connected: this.status === 'CONNECTED',
    grantedScopes: this.grantedScopes,
    shippingRules: this.shippingRules,
    orderPushGraceMinutes: this.orderPushGraceMinutes,
    pushAsTestOrders: this.pushAsTestOrders,
    pricingMode: this.pricingMode,
    markupType: this.markupType,
    markupValue: this.markupValue,
    priceRounding: this.priceRounding,
    defaultCategory: this.defaultCategory,
    shopCurrency: this.shopCurrency,
    shopTaxesIncluded: this.shopTaxesIncluded,
    primaryLocationId: this.primaryLocationId,
    primaryLocationName: this.primaryLocationName,
    protectedCustomerDataOk: this.protectedCustomerDataOk,
    protectedCustomerDataCheckedAt: this.protectedCustomerDataCheckedAt,
    webhookCallbackUrl: this.webhookCallbackUrl,
    webhookRegisteredAt: this.webhookRegisteredAt,
    webhookTopics: this.webhookTopics,
    tokenExpiresAt: this.accessTokenExpiresAt,
    lastConnectionCheckAt: this.lastConnectionCheckAt,
    lastSuccessAt: this.lastSuccessAt,
    lastFailureAt: this.lastFailureAt,
    failureReason: this.failureReason,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('ShopifySettings', shopifySettingsSchema);
