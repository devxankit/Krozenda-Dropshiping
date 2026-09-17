const PickupLocation = require('../../Models/PickupLocation');
const { resolveShippingIntegration } = require('./shippingAccountResolver');
const shiprocketService = require('./shiprocketService');
const { safeCarrierMessage } = require('./shipmentService');

// Registering a warehouse with the carrier.
//
// Shiprocket will not accept an order whose `pickup_location` it does not
// already know, so this has to happen before a seller's first parcel. It is a
// SEPARATE step from saving the address locally, for two reasons: the carrier
// can reject it (wrong pincode, duplicate name) without that being a reason to
// lose the seller's typing, and a seller may want to fix and retry.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// Shiprocket requires `pickup_location` to be unique within the ACCOUNT, and
// caps it at 36 characters. Our nickname is only unique per VENDOR — on the
// shared platform account two sellers could both have a "Main Warehouse", and
// the second registration would collide with the first seller's address.
//
// So the carrier-side name carries a vendor discriminator. It is stored on the
// row (shiprocketLocationName) because every later create/adhoc call must use
// the exact string the carrier knows, not our nickname.
const MAX_CARRIER_NAME = 36;

function buildCarrierName(location) {
  const suffix = String(location.vendor || 'PLT').slice(-6).toUpperCase();
  const slug = String(location.nickname || 'PICKUP')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();

  const room = MAX_CARRIER_NAME - suffix.length - 1;
  return `${slug.slice(0, room)}-${suffix}`;
}

// Maps our stored address onto the carrier's field names. Verified against the
// official Postman collection's "Add a New Pickup Location" request.
function buildPayload(location, carrierName) {
  return {
    pickup_location: carrierName,
    name: location.contactName,
    email: location.email || '',
    phone: location.phone,
    address: location.addressLine1,
    address_2: location.addressLine2 || '',
    city: location.city,
    state: location.state,
    country: location.country || 'India',
    pin_code: location.pincode,
  };
}

// Registers one location against whichever account that seller ships on.
//
// Never throws: a carrier rejection is recorded on the row as
// REGISTRATION_FAILED with a safe reason, because the seller needs to see why
// and fix it, and because a failed registration must not take down the request
// that triggered it.
async function registerLocation(location, { actor = 'SELLER' } = {}) {
  if (location.registrationStatus === 'REGISTERED' && location.shiprocketLocationName) {
    return { ok: true, alreadyRegistered: true, location };
  }

  const resolution = await resolveShippingIntegration({
    vendorId: location.vendor,
    operation: 'ADD_PICKUP_LOCATION',
  });

  if (!resolution.ok) {
    location.registrationStatus = 'REGISTRATION_FAILED';
    location.registrationError = resolution.message;
    await location.save();
    return { ok: false, code: resolution.reason, message: resolution.message, location };
  }

  const carrierName = location.shiprocketLocationName || buildCarrierName(location);

  try {
    const { body } = await shiprocketService.addPickupLocation(
      resolution.integration,
      buildPayload(location, carrierName),
      { onLog: log }
    );

    // The carrier echoes the name it actually stored, which can differ from
    // what was sent. That echo is what later orders must reference, so it wins
    // over our own guess.
    const stored = body?.address?.pickup_code || body?.address?.pickup_location || carrierName;

    location.shiprocketLocationName = String(stored);
    location.registrationStatus = 'REGISTERED';
    location.registrationError = '';
    location.registeredAt = new Date();
    // The exact account it was registered INTO — not just the type. A seller
    // who later switches from the platform account to their own has to
    // register again, because the new account has never heard of this address,
    // and comparing integration ids is how that is detected.
    location.registeredIntegration = resolution.integrationId || resolution.integration?._id || null;
    await location.save();

    log({
      event: 'PICKUP_LOCATION_REGISTERED',
      vendorId: String(location.vendor),
      locationId: String(location._id),
      accountType: resolution.accountType,
      actor,
    });

    return { ok: true, location };
  } catch (err) {
    // A duplicate name is the one failure a seller can act on themselves, so
    // it is worth saying plainly rather than as a generic carrier error.
    const raw = safeCarrierMessage(err, 'pickup address');
    const isDuplicate = /already|exist|duplicate/i.test(raw);

    location.registrationStatus = 'REGISTRATION_FAILED';
    location.registrationError = isDuplicate
      ? 'A pickup address with this name already exists on the courier account. Rename it and try again.'
      : raw;
    await location.save();

    log({
      event: 'PICKUP_LOCATION_REGISTRATION_FAILED',
      vendorId: String(location.vendor),
      locationId: String(location._id),
      code: err.code || null,
    });

    return { ok: false, code: 'CARRIER_ERROR', message: location.registrationError, location };
  }
}

// What the carrier believes this account's warehouses are. Read-only, used to
// reconcile a seller who registered an address directly in the Shiprocket
// panel rather than through us.
async function listCarrierLocations({ vendorId }) {
  const resolution = await resolveShippingIntegration({ vendorId, operation: 'LIST_PICKUP_LOCATIONS' });
  if (!resolution.ok) return { ok: false, code: resolution.reason, message: resolution.message };

  try {
    const { body } = await shiprocketService.listPickupLocations(resolution.integration, { onLog: log });
    const addresses = body?.data?.shipping_address || [];

    return {
      ok: true,
      accountType: resolution.accountType,
      // Only the fields a screen needs. The carrier's payload also carries
      // company and billing details that no seller screen has any use for.
      locations: addresses.map((entry) => ({
        carrierName: entry.pickup_code || entry.pickup_location || '',
        address: entry.address || '',
        city: entry.city || '',
        state: entry.state || '',
        pincode: String(entry.pin_code || ''),
      })),
    };
  } catch (err) {
    return { ok: false, code: 'CARRIER_ERROR', message: safeCarrierMessage(err, 'pickup address list') };
  }
}

module.exports = { registerLocation, listCarrierLocations, buildCarrierName, buildPayload };
