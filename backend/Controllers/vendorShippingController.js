const mongoose = require('mongoose');
const PickupLocation = require('../Models/PickupLocation');
const ShippingIntegration = require('../Models/ShippingIntegration');
const ShippingSettings = require('../Models/ShippingSettings');
const { encrypt, isConfigured, maskEmail } = require('../utils/secretBox');
const authService = require('../services/shipping/shiprocketAuthService');
const shiprocketService = require('../services/shipping/shiprocketService');
const serviceabilityService = require('../services/shipping/serviceabilityService');
const pickupLocationService = require('../services/shipping/pickupLocationService');

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

  // In single-admin Shiprocket mode, the platform Admin Shiprocket account is active for all sellers
  let integrationPayload = null;
  if (!settings.sellerOwnAccountEnabled) {
    integrationPayload = {
      provider: 'SHIPROCKET',
      accountType: 'PLATFORM',
      status: 'CONNECTED',
      isActive: true,
      label: 'Admin Shiprocket Account (Connected)',
      connected: true,
      lastSuccessfulAt: new Date(),
    };
  } else if (integration) {
    integrationPayload = integration.toSafeJSON();
  }

  res.json({
    success: true,
    message: 'Shipping integration fetched successfully',
    data: {
      integration: integrationPayload,
      policy: {
        sellerOwnAccountEnabled: settings.sellerOwnAccountEnabled,
        platformFallbackEnabled: settings.platformFallbackEnabled,
        shippingEnabled: settings.shippingEnabled,
      },
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

  const cleanAddr1 = String(addressLine1 || '').trim();
  if (!cleanAddr1) {
    errors.push('Address line 1 is required.');
  } else if (cleanAddr1.length < 10) {
    errors.push('Address line 1 must be at least 10 characters and include House/Flat/Road no.');
  } else if (cleanAddr1.length > 200) {
    errors.push('Address line 1 is too long.');
  }

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
  const locations = await PickupLocation.find({ vendor: req.vendor._id, isActive: { $ne: false } }).sort({
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
  const existingCount = await PickupLocation.countDocuments({ vendor: req.vendor._id, isActive: { $ne: false } });

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

    // Register it with the carrier immediately, because a location the courier
    // has never heard of cannot ship anything. Deliberately NOT allowed to
    // fail the create: a carrier rejection is recorded on the row with a
    // reason the seller can act on, rather than throwing away their typing.
    const registration = await pickupLocationService.registerLocation(location, { actor: 'SELLER' });

    res.status(201).json({
      success: true,
      message: registration.ok
        ? 'Pickup location added and registered with the courier'
        : `Pickup location saved, but the courier did not accept it: ${registration.message}`,
      data: serializePickupLocation(registration.location || location),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already have a pickup location with that nickname.' });
    }
    throw err;
  }
}

// POST /vendor/shipping/pickup-locations/:id/register
//
// The explicit retry. Separate from create because a seller whose first
// attempt was rejected fixes the address and tries again, and because a
// location registered into the platform account has to be re-registered after
// they connect their own.
async function registerPickupLocation(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid pickup location id' });
  }

  const location = await PickupLocation.findOne({ _id: req.params.id, vendor: req.vendor._id });
  if (!location) {
    return res.status(404).json({ success: false, message: 'Pickup location not found' });
  }

  const result = await pickupLocationService.registerLocation(location, { actor: 'SELLER' });

  const statusCode = result.ok ? 200 : 400;

  res.status(statusCode).json({
    success: result.ok,
    message: result.ok
      ? result.alreadyRegistered
        ? 'This address is already registered with the courier'
        : 'Pickup location registered with the courier'
      : result.message,
    data: serializePickupLocation(result.location || location),
  });
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

  // Check if any existing shipment references this location
  const Shipment = mongoose.model('Shipment');
  const hasShipments = await Shipment.exists({ pickupLocation: location._id });

  if (hasShipments) {
    // Soft-deactivate to preserve historical shipment and manifest records
    location.isActive = false;
    location.isDefault = false;
    location.nickname = `${location.nickname} (deleted-${Date.now().toString().slice(-4)})`;
    await location.save();
  } else {
    // If never used in any shipment, remove document completely
    await PickupLocation.deleteOne({ _id: location._id });
  }

  // If there are other active locations left, ensure one is marked default
  const remainingDefault = await PickupLocation.findOne({ vendor: req.vendor._id, isActive: true, isDefault: true });
  if (!remainingDefault) {
    const next = await PickupLocation.findOne({ vendor: req.vendor._id, isActive: true }).sort({ createdAt: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.json({ success: true, message: 'Pickup location deleted successfully', data: { id: location._id.toString() } });
}

// ---------------------------------------------------------------------------
// Serviceability & rates
// ---------------------------------------------------------------------------

// Couriers are returned without their `raw` carrier payload: that is kept
// server-side for diagnostics and is not something a seller UI needs (or
// should be coupled to).
function serializeCourier(courier) {
  if (!courier) return null;
  const { raw, ...safe } = courier;
  return safe;
}

function serializeServiceability(result) {
  return {
    serviceable: result.serviceable,
    couriers: result.couriers.map(serializeCourier),
    recommended: serializeCourier(result.recommended),
    codAvailable: result.codAvailable,
    strategy: result.strategy,
    // Which account answered — useful to a seller who has just switched from
    // the platform account to their own and wants to know it took effect.
    accountType: result.accountType,
    lane: result.lane,
    ...(result.package ? { package: result.package } : {}),
    ...(result.pickupLocation ? { pickupLocation: result.pickupLocation } : {}),
    ...(result.cod ? { cod: result.cod } : {}),
    ...(result.declaredValue !== undefined ? { declaredValue: result.declaredValue } : {}),
  };
}

// Maps a service-layer failure onto an HTTP status. A lane with no courier is
// NOT an error — it is a 200 with serviceable: false, because the question was
// answered. These are the cases where the question could not be asked.
const SERVICEABILITY_STATUS = {
  ORDER_NOT_FOUND: 404,
  NO_ITEMS_FOR_VENDOR: 403,
  INVALID_PICKUP_PINCODE: 400,
  INVALID_DELIVERY_PINCODE: 400,
  INVALID_WEIGHT: 400,
  INVALID_PACKAGE: 400,
  CARRIER_ERROR: 502,
};

// POST /vendor/shipping/serviceability
//
// Two modes:
//   { orderId, pickupLocationId?, package? }  -> the real check for an order
//   { pickupPincode, deliveryPincode, weightKg, cod? } -> a raw lane check
//
// In order mode nothing that decides the price comes from the request: weight,
// declared value and the COD amount are all read from the database.
async function checkServiceability(req, res) {
  const { orderId, pickupLocationId, package: confirmedPackage } = req.body;

  const result = orderId
    ? await serviceabilityService.checkForOrder({
        orderId,
        // From the token, never the body (task §17).
        vendorId: req.vendor._id,
        pickupLocationId,
        confirmedPackage,
        onLog: logShipping,
      })
    : await serviceabilityService.checkLane({
        vendorId: req.vendor._id,
        pickupPincode: req.body.pickupPincode,
        deliveryPincode: req.body.deliveryPincode,
        weightKg: req.body.weightKg,
        cod: Boolean(req.body.cod),
        declaredValue: Number(req.body.declaredValue) || 0,
        onLog: logShipping,
      });

  if (!result.ok) {
    const status = SERVICEABILITY_STATUS[result.reason] || 400;
    return res.status(status).json({
      success: false,
      code: result.reason,
      message: result.message,
      ...(result.errors ? { data: { errors: result.errors } } : {}),
    });
  }

  res.json({
    success: true,
    message: result.serviceable
      ? 'Shipping rates fetched successfully'
      : 'No courier currently serves this route',
    data: serializeServiceability(result),
  });
}

// POST /vendor/shipping/package/suggest
//
// The "Verify Package" step's starting point: what the system thinks the box
// is, before the seller corrects it. Returns `isEstimate` so the UI can say
// the numbers need checking rather than presenting a guess as fact.
async function suggestPackageForOrder(req, res) {
  const { orderId } = req.body;
  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ success: false, message: 'Invalid order id' });
  }

  const Order = require('../Models/Order');
  const Product = require('../Models/Product');
  const Vendor = require('../Models/Vendor');
  const { suggestPackage } = require('../utils/packaging');

  const order = await Order.findById(orderId).select('items');
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const myItems = order.items.filter((item) => String(item.vendor || '') === String(req.vendor._id));
  if (myItems.length === 0) {
    return res.status(403).json({ success: false, message: 'This order has no items belonging to you.' });
  }

  const [settings, products, vendor] = await Promise.all([
    ShippingSettings.getSettings(),
    Product.find({ _id: { $in: myItems.map((i) => i.product) } }).select('weight dimensions variants._id variants.weight').lean(),
    Vendor.findById(req.vendor._id).select('defaultPackage').lean(),
  ]);

  const productById = new Map(products.map((p) => [String(p._id), p]));
  const pkg = await suggestPackage(
    myItems.map((item) => ({
      quantity: item.quantity,
      product: productById.get(String(item.product)) || {},
      variantId: item.variantId,
    })),
    { settings, vendorDefault: vendor?.defaultPackage || null }
  );

  res.json({
    success: true,
    message: 'Package suggestion generated',
    data: {
      package: pkg,
      items: myItems.map((item) => ({
        productId: item.product.toString(),
        name: item.name,
        quantity: item.quantity,
        hasDimensions: Boolean(productById.get(String(item.product))?.dimensions?.lengthCm),
      })),
    },
  });
}

// Structured shipping log line. Kept to one function so the event names stay
// consistent and so nothing credential-shaped can be passed by accident —
// callers pass ids and masked identifiers only (task §34).
function logShipping(entry) {
  if (!entry || !entry.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

module.exports = {
  registerPickupLocation,
  checkServiceability,
  suggestPackageForOrder,
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
