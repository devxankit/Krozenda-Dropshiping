const ShippingSettings = require('../Models/ShippingSettings');

// Package measurement.
//
// Couriers bill on the GREATER of a parcel's actual weight and its volumetric
// weight, so a large light box costs what its volume costs. Shiprocket
// documents the formula as (L x B x H in cm) / 5000 but is explicit that the
// divisor varies by carrier — which is why it is read from ShippingSettings
// rather than hardcoded here.
//
// Decision B's fallback chain, in order:
//
//   product dimensions  ->  vendor default package  ->  platform default
//
// with the seller able to override everything in the "Verify Package" step.
// The RESULT is snapshotted onto the Shipment, so a later product edit can
// never change what a historical parcel was measured at.

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Volumetric weight in kg for one box.
function volumetricWeightKg({ lengthCm, breadthCm, heightCm }, divisor) {
  const d = Number(divisor) > 0 ? Number(divisor) : 5000;
  const volume = Number(lengthCm) * Number(breadthCm) * Number(heightCm);
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  return round3(volume / d);
}

function chargeableWeightKg(actualKg, volumetricKg) {
  return round3(Math.max(Number(actualKg) || 0, Number(volumetricKg) || 0));
}

// Does this product carry usable shipping dimensions?
function hasDimensions(product) {
  const d = product?.dimensions;
  return Boolean(d && d.lengthCm > 0 && d.breadthCm > 0 && d.heightCm > 0);
}

// Suggests a package for a set of order lines, WITHOUT committing to it. The
// seller confirms or edits the result in the Verify Package step; only then is
// it snapshotted onto the shipment.
//
// The stacking model is deliberately crude and says so: items are assumed to
// stack along the height axis, with the footprint taken as the largest
// length/breadth in the set. Real packing is a bin-packing problem, and a
// marketplace seller with a tape measure will give a better answer than any
// heuristic here — which is exactly why the seller confirms it.
async function suggestPackage(lines, { vendorDefault = null, settings = null } = {}) {
  const config = settings || (await ShippingSettings.getSettings());
  const platformDefault = config.defaultPackage || {};
  const divisor = config.volumetricDivisor || 5000;

  let maxLength = 0;
  let maxBreadth = 0;
  let totalHeight = 0;
  let totalWeight = 0;

  // Records which tier of the fallback chain was actually used, so the seller
  // can be told "these are estimates" rather than being shown a confident
  // number the system guessed.
  let source = 'PRODUCT';
  let usedFallback = false;

  for (const line of lines) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    const product = line.product || {};

    let dims;
    if (hasDimensions(product)) {
      dims = product.dimensions;
    } else if (vendorDefault && vendorDefault.lengthCm > 0) {
      dims = vendorDefault;
      usedFallback = true;
      source = 'VENDOR_DEFAULT';
    } else {
      dims = platformDefault;
      usedFallback = true;
      source = 'PLATFORM_DEFAULT';
    }

    const weight =
      Number(product.weight) > 0
        ? Number(product.weight)
        : Number(vendorDefault?.weightKg) > 0
          ? Number(vendorDefault.weightKg)
          : Number(platformDefault.weightKg) || 0.5;

    maxLength = Math.max(maxLength, Number(dims.lengthCm) || 0);
    maxBreadth = Math.max(maxBreadth, Number(dims.breadthCm) || 0);
    totalHeight += (Number(dims.heightCm) || 0) * qty;
    totalWeight += weight * qty;
  }

  const pkg = {
    lengthCm: round3(maxLength) || platformDefault.lengthCm || 15,
    breadthCm: round3(maxBreadth) || platformDefault.breadthCm || 15,
    heightCm: round3(totalHeight) || platformDefault.heightCm || 10,
    actualWeightKg: round3(totalWeight) || platformDefault.weightKg || 0.5,
  };

  const volumetric = volumetricWeightKg(pkg, divisor);

  return {
    ...pkg,
    volumetricWeightKg: volumetric,
    chargeableWeightKg: chargeableWeightKg(pkg.actualWeightKg, volumetric),
    volumetricDivisor: divisor,
    source,
    // Surfaced in the UI so the seller knows the numbers need checking.
    isEstimate: usedFallback,
  };
}

// Turns a seller's confirmed measurements into the snapshot a Shipment stores.
// Recomputes volumetric and chargeable weight from the CONFIRMED figures
// rather than trusting whatever the client posted — the same rule the audit
// applied to prices and stock (task §48: never trust frontend weight).
function buildPackageSnapshot({ lengthCm, breadthCm, heightCm, actualWeightKg, source = 'MANUAL' }, divisor) {
  const dims = {
    lengthCm: Number(lengthCm),
    breadthCm: Number(breadthCm),
    heightCm: Number(heightCm),
  };
  const actual = Number(actualWeightKg);

  const volumetric = volumetricWeightKg(dims, divisor);

  return {
    ...dims,
    actualWeightKg: round3(actual),
    volumetricWeightKg: volumetric,
    chargeableWeightKg: chargeableWeightKg(actual, volumetric),
    volumetricDivisor: Number(divisor) > 0 ? Number(divisor) : 5000,
    source,
  };
}

// Validation for the Verify Package step. Returns an array of human messages;
// empty means valid.
function validatePackage({ lengthCm, breadthCm, heightCm, actualWeightKg }) {
  const errors = [];
  const check = (value, label, { min, max }) => {
    const n = Number(value);
    if (!Number.isFinite(n)) errors.push(`${label} is required.`);
    else if (n < min) errors.push(`${label} must be at least ${min}.`);
    else if (n > max) errors.push(`${label} looks wrong (over ${max}).`);
  };

  // Upper bounds are sanity checks, not carrier limits: they exist to catch a
  // seller typing millimetres or grams into a centimetre/kilogram field, which
  // would otherwise quote a wildly wrong rate.
  check(lengthCm, 'Length (cm)', { min: 0.5, max: 300 });
  check(breadthCm, 'Breadth (cm)', { min: 0.5, max: 300 });
  check(heightCm, 'Height (cm)', { min: 0.5, max: 300 });
  check(actualWeightKg, 'Weight (kg)', { min: 0.01, max: 300 });

  return errors;
}

module.exports = {
  volumetricWeightKg,
  chargeableWeightKg,
  hasDimensions,
  suggestPackage,
  buildPackageSnapshot,
  validatePackage,
};
