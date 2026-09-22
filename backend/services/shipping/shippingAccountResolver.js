const ShippingIntegration = require('../../Models/ShippingIntegration');
const ShippingSettings = require('../../Models/ShippingSettings');
const PickupLocation = require('../../Models/PickupLocation');

// THE single place that decides which carrier account performs an operation
// (task §44).
//
// Nothing else in the codebase may load a ShippingIntegration to act on it.
// The reason is blunt: if two code paths each decide which account to use,
// they will eventually disagree, and the failure mode is creating Seller A's
// parcel inside Seller B's carrier account — which is both a data breach and a
// billing error, and is invisible until a seller notices someone else's
// shipments on their invoice.
//
// Resolution is deliberately boring and total. Every call returns either an
// `ok: true` result carrying an integration, or an `ok: false` result carrying
// a machine-readable reason. It never throws for a configuration state, and it
// never falls back implicitly.

// Reasons a resolution can fail. Each maps to a specific thing the seller or
// admin has to DO — which is what makes them worth distinguishing.
const BLOCK_REASONS = {
  SHIPPING_DISABLED: 'SHIPPING_DISABLED',
  SELLER_ACCOUNT_NOT_CONNECTED: 'SELLER_ACCOUNT_NOT_CONNECTED',
  SELLER_ACCOUNT_UNHEALTHY: 'SELLER_ACCOUNT_UNHEALTHY',
  PLATFORM_ACCOUNT_NOT_CONFIGURED: 'PLATFORM_ACCOUNT_NOT_CONFIGURED',
  FALLBACK_DISABLED: 'FALLBACK_DISABLED',
  NO_PICKUP_LOCATION: 'NO_PICKUP_LOCATION',
};

const BLOCK_MESSAGES = {
  [BLOCK_REASONS.SHIPPING_DISABLED]:
    'Shipping is turned off for this marketplace. An admin must enable it in Shipping Settings.',
  [BLOCK_REASONS.SELLER_ACCOUNT_NOT_CONNECTED]:
    'This seller has not connected a Shiprocket account, and platform fallback is switched off.',
  [BLOCK_REASONS.SELLER_ACCOUNT_UNHEALTHY]:
    'This seller’s Shiprocket account is not currently connected. Reconnect it from Settings → Shipping.',
  [BLOCK_REASONS.PLATFORM_ACCOUNT_NOT_CONFIGURED]:
    'The platform Shiprocket account is not configured on the server.',
  [BLOCK_REASONS.FALLBACK_DISABLED]:
    'This seller has no working Shiprocket account and platform fallback is switched off.',
  [BLOCK_REASONS.NO_PICKUP_LOCATION]:
    'No active pickup location is set up for this seller. Add one under Settings → Shipping.',
};

function block(reason, extra = {}) {
  return {
    ok: false,
    reason,
    message: BLOCK_MESSAGES[reason] || 'Shipping is not configured for this seller.',
    ...extra,
  };
}

// Is this integration usable right now?
//
// CONNECTED is the only healthy state. TOKEN_EXPIRED is deliberately NOT
// treated as usable: it means the carrier rejected the stored credentials, and
// attempting to ship on it would just fail later, further into the flow, where
// the error is harder to act on.
function isUsable(integration) {
  return Boolean(integration && integration.isActive && integration.status === 'CONNECTED');
}

async function findSellerIntegration(vendorId) {
  if (!vendorId) return null;
  return ShippingIntegration.findOne({
    vendor: vendorId,
    provider: 'SHIPROCKET',
    isActive: true,
  });
}

async function findPlatformIntegration() {
  return ShippingIntegration.findOne({
    accountType: 'PLATFORM',
    provider: 'SHIPROCKET',
    isActive: true,
  });
}

// The platform integration is a singleton row that mirrors the environment
// credentials. It is materialised on first use so that a Shipment always has a
// real integration id to snapshot, even for platform-shipped parcels — without
// it, `Shipment.account.integration` would have to be nullable and every
// downstream lookup would need a special case.
async function ensurePlatformIntegration() {
  const existing = await findPlatformIntegration();
  if (existing) return existing;

  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) return null;

  try {
    return await ShippingIntegration.create({
      vendor: null,
      accountType: 'PLATFORM',
      provider: 'SHIPROCKET',
      // Not CONNECTED: nothing has authenticated yet. The first successful
      // auth flips it, via shiprocketAuthService.recordResult.
      status: 'CONFIGURATION_REQUIRED',
      credentials: {
        // Identifier only. The platform PASSWORD is never persisted — it stays
        // in the environment and is read at login time.
        email: String(process.env.SHIPROCKET_EMAIL).toLowerCase().trim(),
        encryptedPassword: '',
      },
      isActive: true,
    });
  } catch (err) {
    // Lost a race with a concurrent first request; the partial unique index
    // turned it into a duplicate rather than a second platform row.
    if (err.code === 11000) return findPlatformIntegration();
    throw err;
  }
}

// Resolves the pickup location for a shipment.
//
// An explicit id wins (the seller chose a warehouse); otherwise the seller's
// default; otherwise their only active one. Ownership is re-checked against
// the vendor here rather than trusted from the caller — this is the point
// where a supplied id could otherwise become an IDOR (task §17).
async function resolvePickupLocation({ vendorId, pickupLocationId }) {
  if (pickupLocationId) {
    return PickupLocation.findOne({
      _id: pickupLocationId,
      vendor: vendorId || null,
      isActive: true,
    });
  }

  return PickupLocation.findOne({ vendor: vendorId || null, isActive: true }).sort({
    isDefault: -1,
    createdAt: 1,
  });
}

// ---------------------------------------------------------------------------
// resolveShippingIntegration
// ---------------------------------------------------------------------------
// The three outcomes, exactly as specified:
//
//   seller connected                        -> that seller's account
//   not connected + fallback ON             -> platform account
//   not connected + fallback OFF            -> BLOCKED with a reason
//
// `operation` is accepted and echoed for logging and for future per-operation
// policy (e.g. allowing tracking on a disconnected account while forbidding
// new shipments). It does not change routing today, and the code says so
// rather than pretending it does.
async function resolveShippingIntegration({
  vendorId = null,
  pickupLocationId = null,
  operation = 'GENERIC',
  requirePickupLocation = false,
} = {}) {
  const settings = await ShippingSettings.getSettings();

  if (!settings.shippingEnabled) {
    return block(BLOCK_REASONS.SHIPPING_DISABLED, { operation });
  }

  // --- pick the account --------------------------------------------------
  let integration = null;
  let accountType = null;

  if (settings.sellerOwnAccountEnabled && vendorId) {
    const sellerIntegration = await findSellerIntegration(vendorId);

    if (isUsable(sellerIntegration)) {
      integration = sellerIntegration;
      accountType = 'SELLER';
    } else if (sellerIntegration && !settings.platformFallbackEnabled) {
      // The seller HAS an account but it is broken, and there is no fallback.
      // Distinguished from "never connected" because the fix is different.
      return block(BLOCK_REASONS.SELLER_ACCOUNT_UNHEALTHY, {
        operation,
        integrationStatus: sellerIntegration.status,
      });
    }
  }

  if (!integration) {
    if (!settings.platformFallbackEnabled) {
      return block(
        vendorId ? BLOCK_REASONS.FALLBACK_DISABLED : BLOCK_REASONS.PLATFORM_ACCOUNT_NOT_CONFIGURED,
        { operation }
      );
    }

    const platform = await ensurePlatformIntegration();
    if (!platform) {
      return block(BLOCK_REASONS.PLATFORM_ACCOUNT_NOT_CONFIGURED, { operation });
    }

    integration = platform;
    accountType = 'PLATFORM';
  }

  // --- pick the pickup location ------------------------------------------
  const pickupLocation = await resolvePickupLocation({ vendorId, pickupLocationId });
  if (requirePickupLocation && !pickupLocation) {
    return block(BLOCK_REASONS.NO_PICKUP_LOCATION, { operation });
  }

  return {
    ok: true,
    operation,
    provider: integration.provider,
    integration,
    integrationId: integration._id,
    accountType,
    // The seller whose account is in use; null when shipping on the platform's.
    accountOwnerId: accountType === 'SELLER' ? integration.vendor : null,
    // Where the credentials come from — useful in logs, and a reminder that
    // the platform password is never read from the database.
    credentialsSource: accountType === 'PLATFORM' ? 'ENVIRONMENT' : 'ENCRYPTED_RECORD',
    pickupLocation,
    settings,
  };
}

// The exact shape a Shipment stores (task §46). Built here so every caller
// snapshots the same fields and none of them can invent their own.
function toAccountSnapshot(resolution) {
  if (!resolution?.ok) return null;
  return {
    provider: resolution.provider,
    integration: resolution.integrationId,
    accountType: resolution.accountType,
    accountOwner: resolution.accountOwnerId || null,
  };
}

// For operating on an EXISTING shipment (tracking, cancel, label, return).
//
// Uses the shipment's stored snapshot rather than re-resolving from current
// settings — because the seller may have disconnected or switched accounts
// since, and the parcel still lives in the account that created it (task §14,
// §15, §46).
async function resolveForShipment(shipment, { operation = 'GENERIC' } = {}) {
  const snapshot = shipment?.account;
  if (!snapshot?.integration) {
    return block(BLOCK_REASONS.PLATFORM_ACCOUNT_NOT_CONFIGURED, {
      operation,
      detail: 'This shipment has no recorded carrier account.',
    });
  }

  const integration = await ShippingIntegration.findById(snapshot.integration);
  if (!integration) {
    return block(BLOCK_REASONS.PLATFORM_ACCOUNT_NOT_CONFIGURED, {
      operation,
      detail: 'The carrier account this shipment was created with no longer exists.',
    });
  }

  // Note what is NOT checked here: isActive and status. A disconnected account
  // must still be able to TRACK the parcels it already shipped; refusing would
  // strand a buyer's tracking page because their seller changed providers.
  // Operations that create new carrier state go through
  // resolveShippingIntegration instead, which does check health.
  return {
    ok: true,
    operation,
    provider: snapshot.provider,
    integration,
    integrationId: integration._id,
    accountType: snapshot.accountType,
    accountOwnerId: snapshot.accountOwner || null,
    credentialsSource: snapshot.accountType === 'PLATFORM' ? 'ENVIRONMENT' : 'ENCRYPTED_RECORD',
    pickupLocation: null,
  };
}

module.exports = {
  resolveShippingIntegration,
  resolveForShipment,
  toAccountSnapshot,
  ensurePlatformIntegration,
  resolvePickupLocation,
  isUsable,
  BLOCK_REASONS,
  BLOCK_MESSAGES,
};
