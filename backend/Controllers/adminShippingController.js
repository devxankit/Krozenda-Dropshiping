const mongoose = require('mongoose');
const ShippingSettings = require('../Models/ShippingSettings');
const ShippingIntegration = require('../Models/ShippingIntegration');
const Shipment = require('../Models/Shipment');
const Vendor = require('../Models/Vendor');
const { INTEGRATION_STATUSES } = require('../Config/shipping');
const { isConfigured, maskEmail } = require('../utils/secretBox');
const authService = require('../services/shipping/shiprocketAuthService');
const shiprocketService = require('../services/shipping/shiprocketService');
const { ensurePlatformIntegration } = require('../services/shipping/shippingAccountResolver');
const { readPagination, buildPagination } = require('../utils/pagination');

// Platform-wide shipping administration: the policy switches, the platform's
// own carrier account, and a read-only view of which sellers have connected
// accounts of their own.
//
// The rule that shapes this whole file (task §18): an admin may see WHICH
// account shipped a parcel and whether it is healthy. An admin may NOT see the
// seller's carrier email, password, token or any decrypted credential. That is
// why nothing here calls ShippingIntegration.toSafeJSON() — that shape is for
// the account's owner and carries the full email.

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

// The admin view of a carrier account. Built fresh rather than by deleting
// fields from the document, so a field added to the schema later is excluded
// by default instead of leaking until someone remembers to blocklist it.
function serializeIntegrationForAdmin(integration, { vendorName = '' } = {}) {
  return {
    id: integration._id.toString(),
    provider: integration.provider,
    accountType: integration.accountType,
    // The label task §18 asks for. The seller's identity is the vendor, not
    // the carrier login.
    accountLabel: integration.accountType === 'PLATFORM' ? 'Platform Account' : 'Seller Own Account',
    vendorId: integration.vendor ? integration.vendor.toString() : null,
    vendorName,

    status: integration.status,
    isActive: integration.isActive,

    // Masked, never the address itself. Enough for support to tell two
    // accounts apart in a call; not enough to be a contact list.
    maskedEmail: maskEmail(integration.credentials?.email || ''),

    lastTestedAt: integration.lastTestedAt,
    lastSuccessfulAt: integration.lastSuccessfulAt,
    lastFailureAt: integration.lastFailureAt,
    // Already a safe, generic message — see shiprocketAuthService.safeFailureMessage.
    failureReason: integration.failureReason || '',
    consecutiveFailures: integration.consecutiveFailures,
    disconnectedAt: integration.disconnectedAt,
    createdAt: integration.createdAt,
  };
}

function serializeSettings(settings) {
  return {
    shippingEnabled: settings.shippingEnabled,
    provider: settings.provider,

    sellerOwnAccountEnabled: settings.sellerOwnAccountEnabled,
    platformFallbackEnabled: settings.platformFallbackEnabled,

    courierSelectionStrategy: settings.courierSelectionStrategy,
    blockedCourierIds: settings.blockedCourierIds,

    volumetricDivisor: settings.volumetricDivisor,
    defaultPackage: {
      lengthCm: settings.defaultPackage.lengthCm,
      breadthCm: settings.defaultPackage.breadthCm,
      heightCm: settings.defaultPackage.heightCm,
      weightKg: settings.defaultPackage.weightKg,
    },

    codEnabled: settings.codEnabled,
    freeShippingThreshold: settings.freeShippingThreshold ?? 0,

    trackingPollEnabled: settings.trackingPollEnabled,
    trackingPollCron: settings.trackingPollCron,
    trackingStaleAfterMinutes: settings.trackingStaleAfterMinutes,
    trackingPollBatchSize: settings.trackingPollBatchSize,

    updatedAt: settings.updatedAt,
  };
}

// What the SERVER is configured to do, as opposed to what the settings ask for.
// A toggle that cannot work because an environment variable is missing should
// say so on the screen rather than failing at the first shipment.
function readinessFlags() {
  return {
    // Sellers cannot connect their own accounts without this: there would be
    // nowhere safe to put their password.
    credentialEncryptionConfigured: isConfigured(),
    // Booleans only. The values themselves never leave the server (task §5).
    platformCredentialsConfigured: Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD),
    // Without this the webhook endpoint refuses every delivery (503), so
    // tracking would fall back to the poller alone.
    webhookConfigured: Boolean(process.env.SHIPROCKET_WEBHOOK_TOKEN),
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// GET /admin/shipping/settings
async function getSettings(req, res) {
  const settings = await ShippingSettings.getSettings();
  // Creates the platform row on first read when env credentials exist, so the
  // screen can show its health instead of "not configured" until the first
  // shipment happens to create it.
  const platform = await ensurePlatformIntegration();

  res.json({
    success: true,
    message: 'Shipping settings fetched successfully',
    data: {
      settings: serializeSettings(settings),
      platformAccount: platform ? serializeIntegrationForAdmin(platform) : null,
      readiness: readinessFlags(),
      // Which carrier operations are actually implemented, so the UI can
      // disable a button rather than offer an action that returns 501.
      capabilities: shiprocketService.CAPABILITIES,
      strategies: ShippingSettings.COURIER_SELECTION_STRATEGIES,
    },
  });
}

// Only these may be written, and each is validated. An allowlist rather than a
// merge: `Object.assign(settings, req.body)` would let a caller set `key`,
// `updatedBy` or anything a later schema adds.
const NUMERIC_BOUNDS = {
  volumetricDivisor: { min: 1, max: 100000 },
  trackingStaleAfterMinutes: { min: 15, max: 10080 },
  trackingPollBatchSize: { min: 1, max: 500 },
};

const PACKAGE_BOUNDS = {
  lengthCm: { min: 0.5, max: 300 },
  breadthCm: { min: 0.5, max: 300 },
  heightCm: { min: 0.5, max: 300 },
  weightKg: { min: 0.01, max: 500 },
};

function readBoolean(body, key, current) {
  return typeof body[key] === 'boolean' ? body[key] : current;
}

function readBounded(body, key, current, errors) {
  if (body[key] === undefined) return current;

  const value = Number(body[key]);
  const { min, max } = NUMERIC_BOUNDS[key];
  if (!Number.isFinite(value) || value < min || value > max) {
    errors.push(`${key} must be a number between ${min} and ${max}`);
    return current;
  }
  return value;
}

// PUT /admin/shipping/settings
async function updateSettings(req, res) {
  const body = req.body || {};
  const errors = [];
  const settings = await ShippingSettings.getSettings();

  settings.shippingEnabled = readBoolean(body, 'shippingEnabled', settings.shippingEnabled);
  settings.sellerOwnAccountEnabled = readBoolean(body, 'sellerOwnAccountEnabled', settings.sellerOwnAccountEnabled);
  settings.platformFallbackEnabled = readBoolean(body, 'platformFallbackEnabled', settings.platformFallbackEnabled);
  settings.codEnabled = readBoolean(body, 'codEnabled', settings.codEnabled);
  settings.trackingPollEnabled = readBoolean(body, 'trackingPollEnabled', settings.trackingPollEnabled);

  if (body.courierSelectionStrategy !== undefined) {
    if (!ShippingSettings.COURIER_SELECTION_STRATEGIES.includes(body.courierSelectionStrategy)) {
      errors.push(`courierSelectionStrategy must be one of: ${ShippingSettings.COURIER_SELECTION_STRATEGIES.join(', ')}`);
    } else {
      settings.courierSelectionStrategy = body.courierSelectionStrategy;
    }
  }

  if (body.blockedCourierIds !== undefined) {
    if (!Array.isArray(body.blockedCourierIds)) {
      errors.push('blockedCourierIds must be an array of courier ids');
    } else {
      const ids = body.blockedCourierIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length !== body.blockedCourierIds.length) {
        errors.push('blockedCourierIds must contain positive whole numbers only');
      } else {
        settings.blockedCourierIds = [...new Set(ids)];
      }
    }
  }

  settings.volumetricDivisor = readBounded(body, 'volumetricDivisor', settings.volumetricDivisor, errors);
  settings.trackingStaleAfterMinutes = readBounded(body, 'trackingStaleAfterMinutes', settings.trackingStaleAfterMinutes, errors);
  settings.trackingPollBatchSize = readBounded(body, 'trackingPollBatchSize', settings.trackingPollBatchSize, errors);

  if (body.freeShippingThreshold !== undefined) {
    const threshold = Number(body.freeShippingThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      errors.push('freeShippingThreshold must be a number greater than or equal to 0');
    } else {
      settings.freeShippingThreshold = threshold;
    }
  }

  if (body.trackingPollCron !== undefined) {
    // Validated with the same library the scheduler uses, so a value accepted
    // here cannot be one the poller refuses to start on.
    const cron = require('node-cron');
    if (typeof body.trackingPollCron !== 'string' || !cron.validate(body.trackingPollCron)) {
      errors.push('trackingPollCron must be a valid cron expression, e.g. "*/30 * * * *"');
    } else {
      settings.trackingPollCron = body.trackingPollCron.trim();
    }
  }

  if (body.defaultPackage !== undefined) {
    if (typeof body.defaultPackage !== 'object' || body.defaultPackage === null) {
      errors.push('defaultPackage must be an object');
    } else {
      for (const [key, { min, max }] of Object.entries(PACKAGE_BOUNDS)) {
        if (body.defaultPackage[key] === undefined) continue;
        const value = Number(body.defaultPackage[key]);
        if (!Number.isFinite(value) || value < min || value > max) {
          errors.push(`defaultPackage.${key} must be between ${min} and ${max}`);
        } else {
          settings.defaultPackage[key] = value;
        }
      }
    }
  }

  if (errors.length) {
    // Nothing is saved when any field is invalid — a partial write would leave
    // the admin unsure which half of their form took effect.
    return res.status(400).json({
      success: false,
      code: 'INVALID_SHIPPING_SETTINGS',
      message: 'Some settings could not be saved',
      data: { errors },
    });
  }

  settings.updatedBy = req.admin?._id || null;
  await settings.save();

  // The poller reads its schedule from these settings on every tick, so a cron
  // change takes effect without a restart — but the SCHEDULE itself was fixed
  // at boot. Say so rather than letting an admin believe a new cadence is live.
  const scheduleChanged = body.trackingPollCron !== undefined;

  res.json({
    success: true,
    message: scheduleChanged
      ? 'Shipping settings saved. The new polling schedule takes effect after the next server restart.'
      : 'Shipping settings saved',
    data: {
      settings: serializeSettings(settings),
      readiness: readinessFlags(),
    },
  });
}

// ---------------------------------------------------------------------------
// Carrier accounts
// ---------------------------------------------------------------------------

// GET /admin/shipping/integrations
//
// Who is shipping on what. Read-only on purpose: an admin cannot edit, test or
// re-authenticate a seller's carrier account, because doing so would require
// handling that seller's credentials.
async function listIntegrations(req, res) {
  const { page, limit, skip } = readPagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const { status, accountType, vendorId } = req.query;

  const filter = {};
  if (status && INTEGRATION_STATUSES.includes(status)) filter.status = status;
  if (accountType === 'PLATFORM' || accountType === 'SELLER') filter.accountType = accountType;
  if (vendorId && mongoose.isValidObjectId(vendorId)) filter.vendor = vendorId;

  const [integrations, total] = await Promise.all([
    ShippingIntegration.find(filter).sort({ isActive: -1, lastFailureAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    ShippingIntegration.countDocuments(filter),
  ]);

  // One batched lookup for the names, rather than a populate that would pull
  // whole vendor documents onto a screen that needs a label.
  const vendorIds = integrations.map((i) => i.vendor).filter(Boolean);
  const vendors = vendorIds.length
    ? await Vendor.find({ _id: { $in: vendorIds } }).select('name business.businessName').lean()
    : [];
  // Same label the accounting screens use, so one seller reads the same way
  // across the admin panel.
  const nameById = new Map(vendors.map((v) => [v._id.toString(), v.business?.businessName || v.name || '']));

  res.json({
    success: true,
    message: 'Carrier accounts fetched successfully',
    data: {
      items: integrations.map((i) =>
        serializeIntegrationForAdmin(i, { vendorName: i.vendor ? nameById.get(i.vendor.toString()) || '' : '' })
      ),
      total,
    },
    pagination: buildPagination({ page, limit, total }),
  });
}

// GET /admin/shipping/overview
//
// The numbers an admin actually acts on: how many accounts are failing, and
// how many parcels are stuck waiting for a human.
async function getOverview(req, res) {
  const [accountCounts, shipmentCounts, reconciliation] = await Promise.all([
    ShippingIntegration.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: { accountType: '$accountType', status: '$status' }, count: { $sum: 1 } } },
    ]),
    Shipment.aggregate([{ $group: { _id: '$internalStatus', count: { $sum: 1 } } }]),
    Shipment.countDocuments({ reconciliationRequired: true }),
  ]);

  const byStatus = {};
  for (const row of shipmentCounts) byStatus[row._id] = row.count;

  const accounts = { platform: {}, seller: {} };
  for (const row of accountCounts) {
    const bucket = row._id.accountType === 'PLATFORM' ? accounts.platform : accounts.seller;
    bucket[row._id.status] = (bucket[row._id.status] || 0) + row.count;
  }

  res.json({
    success: true,
    message: 'Shipping overview fetched successfully',
    data: {
      accounts,
      shipmentsByStatus: byStatus,
      // Parcels whose carrier call timed out mid-flight. Each one needs
      // checking in the Shiprocket panel before it is retried, or it becomes a
      // duplicate parcel — see shipmentService's timeout branch.
      reconciliationRequired: reconciliation,
      readiness: readinessFlags(),
    },
  });
}

// POST /admin/shipping/platform/test-connection
//
// Verifies the credentials that are already in the environment. It takes NO
// body: an admin does not type the platform password into a browser, because
// that would put it in a request, a log and possibly a password manager.
// Rotating it is a deployment change (task §5).
async function testPlatformConnection(req, res) {
  if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
    return res.status(503).json({
      success: false,
      code: 'PLATFORM_CREDENTIALS_MISSING',
      message: 'SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are not set on this server.',
      data: { connected: false },
    });
  }

  const integration = await ensurePlatformIntegration();
  if (!integration) {
    return res.status(503).json({
      success: false,
      code: 'PLATFORM_ACCOUNT_NOT_CONFIGURED',
      message: 'The platform carrier account could not be prepared.',
      data: { connected: false },
    });
  }

  const result = await authService.testConnection(integration);
  const fresh = await ShippingIntegration.findById(integration._id);

  res.status(result.connected ? 200 : 502).json({
    success: result.connected,
    // `reason` is already safeFailureMessage() output — never the carrier's
    // raw response, and never anything echoing the credential.
    message: result.connected ? 'Platform Shiprocket account is connected' : result.reason,
    data: {
      connected: result.connected,
      testedAt: result.testedAt,
      platformAccount: serializeIntegrationForAdmin(fresh),
    },
  });
}

module.exports = {
  getSettings,
  updateSettings,
  listIntegrations,
  getOverview,
  testPlatformConnection,
  serializeIntegrationForAdmin,
};
