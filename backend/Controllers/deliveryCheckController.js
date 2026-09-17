const mongoose = require('mongoose');
const Product = require('../Models/Product');
const Vendor = require('../Models/Vendor');
const PickupLocation = require('../Models/PickupLocation');
const ShippingSettings = require('../Models/ShippingSettings');
const serviceabilityService = require('../services/shipping/serviceabilityService');
const { suggestPackage } = require('../utils/packaging');
const { publiclyVisible } = require('../utils/publicVisibility');

// "Will you deliver to my PIN code, and what will it cost?" — asked from the
// product page, before anyone has signed in or added anything to a cart.
//
// This is the only place a BUYER causes a carrier call, which shapes it:
//
//   * unauthenticated, so it is rate limited and answers from the
//     serviceability cache wherever it can
//   * it returns a price and a date and nothing else. No courier list, no
//     seller identity, no pickup address, no account type — a buyer has no use
//     for any of it, and the pickup pincode in particular is the seller's
//     business address
//   * an unserviceable lane is a normal 200 answer, not an error: the question
//     was asked and answered

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// Where this product ships FROM.
//
// The seller's default registered warehouse, else any registered one they
// have, else the marketplace's own origin. Without an origin there is no lane
// and therefore no quote — and saying so is better than quoting from a
// pincode we guessed.
async function resolveOrigin(product, settings) {
  if (product.vendor) {
    const own = await PickupLocation.findOne({
      vendor: product.vendor,
      isActive: true,
      registrationStatus: 'REGISTERED',
    })
      .sort({ isDefault: -1, createdAt: 1 })
      .select('pincode city')
      .lean();

    if (own?.pincode) return { pincode: own.pincode, source: 'SELLER' };
  }

  if (settings.defaultOriginPincode) {
    return { pincode: settings.defaultOriginPincode, source: 'PLATFORM' };
  }

  return null;
}

// GET /catalog/products/:id/delivery?pincode=452001
async function checkProductDelivery(req, res) {
  const { id } = req.params;
  const pincode = String(req.query.pincode || '').trim();

  // A live carrier quote must not sit in a browser cache. Two reasons, and
  // both have bitten:
  //
  //   1. A cached rate is a stale price. Couriers change them, and a shopper
  //      shown yesterday's figure is being told something untrue.
  //   2. Express adds an ETag to every JSON response, so the browser
  //      revalidates and the server answers 304 with an EMPTY body. Axios
  //      treats 304 as a failure (its default validateStatus is 2xx only), so
  //      the check fails for a response that was technically fine.
  //
  // Repeat lookups are still cheap: serviceabilityService keeps its own
  // 5-minute per-lane cache on the server, which is where a shared cache
  // belongs.
  res.set('Cache-Control', 'no-store');

  // no-store alone is NOT enough, which is the part that actually bit.
  // Express computes the ETag inside res.send(), after this handler has run,
  // and its freshness check compares the request's If-None-Match against it
  // without consulting Cache-Control at all — so it would still answer 304
  // with an empty body. Dropping the conditional header means the response
  // can never be considered fresh, so a full body is always sent.
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }
  if (!/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ success: false, message: 'Enter a valid 6-digit PIN code.' });
  }

  // Only a product a buyer can actually see. Quoting delivery for a pending or
  // deactivated product would confirm it exists.
  const product = await Product.findOne({ _id: id, ...publiclyVisible() })
    .select('vendor weight dimensions price salePrice')
    .lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const settings = await ShippingSettings.getSettings();
  if (!settings.shippingEnabled) {
    return res.json({
      success: true,
      message: 'Delivery check unavailable',
      data: { available: false, reason: 'SHIPPING_DISABLED', pincode },
    });
  }

  const origin = await resolveOrigin(product, settings);
  if (!origin) {
    // No warehouse anywhere: honest "cannot say" rather than a made-up rate.
    return res.json({
      success: true,
      message: 'Delivery check unavailable',
      data: { available: false, reason: 'NO_ORIGIN', pincode },
    });
  }

  // One unit, since that is what the product page is about. The cart's real
  // weight is worked out again at shipment time from everything in the box.
  const vendor = product.vendor
    ? await Vendor.findById(product.vendor).select('defaultPackage').lean()
    : null;

  const pkg = await suggestPackage([{ quantity: 1, product }], {
    settings,
    vendorDefault: vendor?.defaultPackage || null,
  });

  const lane = {
    vendorId: product.vendor || null,
    pickupPincode: origin.pincode,
    deliveryPincode: pincode,
    weightKg: pkg.chargeableWeightKg,
    declaredValue: product.salePrice ?? product.price ?? 0,
    onLog: log,
  };

  // Two questions, because a courier that serves a lane prepaid may not do COD
  // there. Both hit the same 5-minute lane cache.
  const [prepaid, cod] = await Promise.all([
    serviceabilityService.checkLane({ ...lane, cod: false }),
    serviceabilityService.checkLane({ ...lane, cod: true, requiresCod: true }),
  ]);

  if (!prepaid.ok && !cod.ok) {
    // The carrier could not be reached. NOT "we do not deliver there" — those
    // are different answers and conflating them loses a sale.
    return res.json({
      success: true,
      message: 'Delivery check unavailable',
      data: { available: false, reason: 'CARRIER_UNAVAILABLE', pincode },
    });
  }

  const best = (result) => {
    if (!result.ok || !result.serviceable || result.couriers.length === 0) return null;
    // Cheapest quotable option. A courier that reported no rate is skipped
    // rather than treated as free.
    const rated = result.couriers.filter((c) => Number.isFinite(c.estimatedCost));
    if (rated.length === 0) return null;
    return rated.reduce((a, b) => (b.estimatedCost < a.estimatedCost ? b : a));
  };

  const prepaidBest = best(prepaid);
  const codBest = best(cod);
  const fastest = [prepaidBest, codBest]
    .filter((c) => c && Number.isFinite(c.estimatedDeliveryDays))
    .sort((a, b) => a.estimatedDeliveryDays - b.estimatedDeliveryDays)[0];

  const serviceable = Boolean(prepaidBest || codBest);

  res.json({
    success: true,
    message: serviceable ? 'Delivery available' : 'Not serviceable',
    data: {
      available: true,
      pincode,
      serviceable,

      // What the CARRIER charges for this parcel on this lane. Whether the
      // buyer is charged this, or the marketplace's own flat rate, is a
      // checkout decision — see the note in the route file.
      prepaid: prepaidBest
        ? { available: true, charge: round2(prepaidBest.estimatedCost) }
        : { available: false, charge: null },

      cod: settings.codEnabled && codBest
        ? { available: true, charge: round2(codBest.estimatedCost) }
        : { available: false, charge: null },

      estimatedDays: fastest?.estimatedDeliveryDays ?? null,
      estimatedDeliveryDate: estimateDate(fastest?.estimatedDeliveryDays),
    },
  });
}

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

// The carrier gives a number of days; a date is what a buyer can actually act
// on. Computed here rather than passing the carrier's own `etd` string
// through, because that arrives in several formats.
function estimateDate(days) {
  if (!Number.isFinite(days) || days <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + Math.ceil(days));
  return date.toISOString().slice(0, 10);
}

module.exports = { checkProductDelivery };
