const mongoose = require('mongoose');
const PickupLocation = require('../Models/PickupLocation');
const ShippingIntegration = require('../Models/ShippingIntegration');
const ShippingSettings = require('../Models/ShippingSettings');
const { encrypt, isConfigured, maskEmail } = require('../utils/secretBox');
const authService = require('../services/shipping/shiprocketAuthService');
const shiprocketService = require('../services/shipping/shiprocketService');

// Seller-facing shipping settings: their carrier account, and their warehouses.
//
// EVERY handler derives the seller from `req.vendor._id`, set by protectVendor
// from the bearer token. A vendorId is never read from the body, the query or
// the path — task §17's rule, and the reason Seller A cannot touch Seller B's
// integration or pickup locations no matter what they post.

// ---------------------------------------------------------------------------
// Shiprocket account
// ---------------------------------------------------------------------------

// GET /vendor/shipping/integration
async function getMyIntegration(req, res) {
  const [settings, integration] = await Promise.all([
    ShippingSettings.getSettings(),
    ShippingIntegration.findOne({ vendor: req.vendor._id, provider: 'SHIPROCKET', isActive: true }),
  ]);

  res.json({
    success: true,
    message: 'Shipping integration fetched successfully',
    data: {
      // toSafeJSON is the only shape allowed out — see the model.
      integration: integration ? integration.toSafeJSON() : null,
      // What the seller is ALLOWED to do, so the UI can explain itself rather
      // than showing a form that will be ignored.
      policy: {
        sellerOwnAccountEnabled: settings.sellerOwnAccountEnabled,
        platformFallbackEnabled: settings.platformFallbackEnabled,
        shippingEnabled: settings.shippingEnabled,
      },
      // False when the server has no encryption key, which means seller
      // credentials cannot be stored at all. Better to say so than to accept
      // a password and fail on save.
      canStoreCredentials: isConfigured(),
      capabilities: shiprocketService.CAPABILITIES,
    },
  });
}

// POST /vendor/shipping/integration/test-connection
//
// Saves the credentials and immediately verifies them against Shiprocket. The
// two are deliberately one operation: a "save" that did not prove the account
// works would leave the seller believing they are connected when they are not.
async function testConnection(req, res) {
  const { email, password } = req.body;

  const settings = await ShippingSettings.getSettings();
  if (!settings.sellerOwnAccountEnabled) {
    return res.status(403).json({
      success: false,
      message: 'Seller-owned Shiprocket accounts are turned off for this marketplace.',
      data: { connected: false },
    });
  }

  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'This server is not configured to store carrier credentials securely. Contact the platform administrator.',
      data: { connected: false },
    });
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Enter a valid Shiprocket account email', data: { connected: false } });
  }

  // An existing integration may be re-tested without re-entering the password.
  const existing = await ShippingIntegration.findOne({
    vendor: req.vendor._id,
    provider: 'SHIPROCKET',
    isActive: true,
  });

  const hasNewPassword = typeof password === 'string' && password.length > 0;
  if (!hasNewPassword && !existing) {
    return res.status(400).json({ success: false, message: 'Enter your Shiprocket password', data: { connected: false } });
  }

  let integration = existing;
  if (!integration) {
    integration = new ShippingIntegration({
      vendor: req.vendor._id,
      accountType: 'SELLER',
      provider: 'SHIPROCKET',
      status: 'CONFIGURATION_REQUIRED',
    });
  }

  integration.credentials.email = cleanEmail;
  if (hasNewPassword) {
    integration.credentials.encryptedPassword = encrypt(password);
    integration.credentials.credentialVersion = 1;
  }
  integration.isActive = true;
  integration.disconnectedAt = null;
  await integration.save();

  // Clear any token cached against a previous password for this integration,
  // or the test would pass on a stale token and hide a wrong password.
  authService.invalidate(integration._id);

  const result = await authService.testConnection(integration, { onLog: logShipping });

  // Re-read: testConnection writes health fields through the model.
  const refreshed = await ShippingIntegration.findById(integration._id);

  logShipping({
    event: result.connected ? 'SELLER_SHIPROCKET_CONNECTED' : 'SELLER_SHIPROCKET_CONNECTION_FAILED',
    vendorId: String(req.vendor._id),
    account: maskEmail(cleanEmail),
  });

  return res.status(result.connected ? 200 : 400).json({
    success: result.connected,
    message: result.connected
      ? 'Shiprocket connected successfully'
      : result.reason || 'Unable to connect Shiprocket account',
    data: {
      connected: result.connected,
      lastTestedAt: result.testedAt,
      integration: refreshed ? refreshed.toSafeJSON() : null,
    },
  });
}

// DELETE /vendor/shipping/integration
//
// Soft disconnect. The row is kept so historical shipments can still resolve
// the account they were created with (task §12, §46) — but the stored
// credential is destroyed, because there is no reason to keep a password for
// an account the seller has stopped using.
async function disconnectIntegration(req, res) {
  const integration = await ShippingIntegration.findOne({
    vendor: req.vendor._id,
    provider: 'SHIPROCKET',
    isActive: true,
  });

  if (!integration) {
    return res.status(404).json({ success: false, message: 'No connected Shiprocket account to disconnect' });
  }

  integration.isActive = false;
  integration.status = 'DISCONNECTED';
  integration.disconnectedAt = new Date();
  integration.credentials.encryptedPassword = '';
  await integration.save();

  // Drop the cached token so a disconnected account cannot keep shipping from
  // this process's memory until the TTL lapses.
  authService.invalidate(integration._id);

  logShipping({ event: 'SELLER_SHIPROCKET_DISCONNECTED', vendorId: String(req.vendor._id) });

  const settings = await ShippingSettings.getSettings();
  res.json({
    success: true,
    message: settings.platformFallbackEnabled
      ? 'Shiprocket account disconnected. New shipments will use the platform account.'
      : 'Shiprocket account disconnected. You will not be able to create new shipments until you reconnect.',
    data: { connected: false },
  });
}

// ---------------------------------------------------------------------------
// Pickup locations
// ---------------------------------------------------------------------------

function serializePickupLocation(location) {
  return {
    id: location._id.toString(),
    nickname: location.nickname,
    contactName: location.contactName,
    phone: location.phone,
    email: location.email || '',
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2 || '',
    city: location.city,
    state: location.state,
    pincode: location.pincode,
    country: location.country,
    registrationStatus: location.registrationStatus,
    registrationError: location.registrationError || '',
    shiprocketLocationName: location.shiprocketLocationName || '',
    isDefault: location.isDefault,
    isActive: location.isActive,
    createdAt: location.createdAt,
  };
}

// Shared validation. Returns an array of messages; empty means valid.
function validateLocation({ nickname, contactName, phone, addressLine1, city, state, pincode }) {
  const errors = [];
  const required = (value, label, max = 200) => {
    const v = String(value || '').trim();
    if (!v) errors.push(`${label} is required.`);
    else if (v.length > max) errors.push(`${label} is too long.`);
  };

  required(nickname, 'Nickname', 60);
  required(contactName, 'Contact name', 120);
  required(addressLine1, 'Address', 200);
  required(city, 'City', 100);
  required(state, 'State', 100);

  // Indian mobile numbers start 6-9 and are 10 digits. Shiprocket rejects
  // anything else, so catching it here saves a round trip and gives a better
  // message than the carrier's.
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) errors.push('Enter a valid 10-digit mobile number.');

  if (!/^\d{6}$/.test(String(pincode || '').trim())) errors.push('Enter a valid 6-digit PIN code.');

  return errors;
}

// GET /vendor/shipping/pickup-locations
async function listPickupLocations(req, res) {
  const locations = await PickupLocation.find({ vendor: req.vendor._id }).sort({
    isDefault: -1,
    createdAt: 1,
  });

  res.json({
    success: true,
    message: 'Pickup locations fetched successfully',
    data: {
      items: locations.map(serializePickupLocation),
      total: locations.length,
      // Surfaced so the UI can explain why a location says NOT_REGISTERED and
      // what the seller has to do about it, rather than leaving it a mystery.
      registrationSupported: shiprocketService.CAPABILITIES.addPickupLocation,
    },
  });
}

// POST /vendor/shipping/pickup-locations
async function createPickupLocation(req, res) {
  const errors = validateLocation(req.body);
  if (errors.length) {
    return res.status(400).json({ success: false, message: errors[0], data: { errors } });
  }

  const { nickname, contactName, phone, email, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

  // A seller's first location becomes their default automatically — otherwise
  // they would have a location and still be blocked for not having a default.
  const existingCount = await PickupLocation.countDocuments({ vendor: req.vendor._id });

  try {
    const location = await PickupLocation.create({
      vendor: req.vendor._id,
      nickname: String(nickname).trim(),
      contactName: String(contactName).trim(),
      phone: String(phone).replace(/\D/g, '').slice(-10),
      email: email ? String(email).trim().toLowerCase() : '',
      addressLine1: String(addressLine1).trim(),
      addressLine2: addressLine2 ? String(addressLine2).trim() : '',
      city: String(city).trim(),
      state: String(state).trim(),
      pincode: String(pincode).trim(),
      isDefault: existingCount === 0 ? true : Boolean(isDefault),
    });

    logShipping({
      event: 'SELLER_PICKUP_LOCATION_CREATED',
      vendorId: String(req.vendor._id),
      locationId: String(location._id),
    });

    res.status(201).json({
      success: true,
      message: shiprocketService.CAPABILITIES.addPickupLocation
        ? 'Pickup location added'
        : 'Pickup location saved. Register it in your Shiprocket panel with the same nickname before shipping from it.',
      data: serializePickupLocation(location),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already have a pickup location with that nickname.' });
    }
    throw err;
  }
}

// PUT /vendor/shipping/pickup-locations/:id
async function updatePickupLocation(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid pickup location id' });
  }

  const errors = validateLocation(req.body);
  if (errors.length) {
    return res.status(400).json({ success: false, message: errors[0], data: { errors } });
  }

  // Scoped to the authenticated seller — this is the IDOR guard. Another
  // seller's id simply does not match and returns 404.
  const location = await PickupLocation.findOne({ _id: id, vendor: req.vendor._id });
  if (!location) {
    return res.status(404).json({ success: false, message: 'Pickup location not found' });
  }

  const { nickname, contactName, phone, email, addressLine1, addressLine2, city, state, pincode, isDefault } = req.body;

  // Changing the address means the carrier's registered copy no longer
  // matches, so registration has to be redone. Silently keeping REGISTERED
  // would let a parcel be scheduled for collection from the old address.
  const addressChanged =
    location.addressLine1 !== String(addressLine1).trim() ||
    location.pincode !== String(pincode).trim() ||
    location.city !== String(city).trim();

  location.nickname = String(nickname).trim();
  location.contactName = String(contactName).trim();
  location.phone = String(phone).replace(/\D/g, '').slice(-10);
  location.email = email ? String(email).trim().toLowerCase() : '';
  location.addressLine1 = String(addressLine1).trim();
  location.addressLine2 = addressLine2 ? String(addressLine2).trim() : '';
  location.city = String(city).trim();
  location.state = String(state).trim();
  location.pincode = String(pincode).trim();
  if (isDefault !== undefined) location.isDefault = Boolean(isDefault);

  if (addressChanged && location.registrationStatus === 'REGISTERED') {
    location.registrationStatus = 'NOT_REGISTERED';
    location.registrationError = 'Address changed after registration — re-register this location with the carrier.';
  }

  try {
    await location.save();
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already have a pickup location with that nickname.' });
    }
    throw err;
  }

  res.json({ success: true, message: 'Pickup location updated', data: serializePickupLocation(location) });
}

// PATCH /vendor/shipping/pickup-locations/:id/default
async function setDefaultPickupLocation(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid pickup location id' });
  }

  const location = await PickupLocation.findOne({ _id: id, vendor: req.vendor._id, isActive: true });
  if (!location) {
    return res.status(404).json({ success: false, message: 'Pickup location not found' });
  }

  location.isDefault = true;
  await location.save(); // the pre-save hook clears the previous default

  res.json({ success: true, message: 'Default pickup location updated', data: serializePickupLocation(location) });
}

// DELETE /vendor/shipping/pickup-locations/:id
//
// Deactivates rather than deletes: shipments reference the location they were
// collected from, and a hard delete would orphan that reference.
async function deactivatePickupLocation(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid pickup location id' });
  }

  const location = await PickupLocation.findOne({ _id: id, vendor: req.vendor._id });
  if (!location) {
    return res.status(404).json({ success: false, message: 'Pickup location not found' });
  }

  // Refuse to leave a seller with no usable pickup point while they still have
  // shipping enabled — they would find out at the worst moment, mid-shipment.
  const remaining = await PickupLocation.countDocuments({
    vendor: req.vendor._id,
    isActive: true,
    _id: { $ne: location._id },
  });
  if (remaining === 0) {
    return res.status(400).json({
      success: false,
      message: 'This is your only active pickup location. Add another before removing this one.',
    });
  }

  location.isActive = false;
  location.isDefault = false;
  await location.save();

  // If that was the default, promote the oldest remaining one so the seller is
  // never left without a default.
  const hasDefault = await PickupLocation.exists({ vendor: req.vendor._id, isActive: true, isDefault: true });
  if (!hasDefault) {
    const next = await PickupLocation.findOne({ vendor: req.vendor._id, isActive: true }).sort({ createdAt: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.json({ success: true, message: 'Pickup location removed', data: { id: location._id.toString() } });
}

// Structured shipping log line. Kept to one function so the event names stay
// consistent and so nothing credential-shaped can be passed by accident —
// callers pass ids and masked identifiers only (task §34).
function logShipping(entry) {
  if (!entry || !entry.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

module.exports = {
  getMyIntegration,
  testConnection,
  disconnectIntegration,
  listPickupLocations,
  createPickupLocation,
  updatePickupLocation,
  setDefaultPickupLocation,
  deactivatePickupLocation,
  serializePickupLocation,
  validateLocation,
  logShipping,
};
