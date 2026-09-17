const PickupLocation = require('../../Models/PickupLocation');
const Vendor = require('../../Models/Vendor');
const ShippingSettings = require('../../Models/ShippingSettings');
const serviceabilityService = require('./serviceabilityService');
const { suggestPackage } = require('../../utils/packaging');

// What shipping costs for a whole cart, at checkout.
//
// THE RULE THIS FILE EXISTS FOR: the buyer never tells us what shipping costs.
// Before this, the client sent `shippingFee` and the server checked it was one
// of [0, 99, 199] — so a buyer could pick 0 for any order and the server
// agreed. Now the fee is computed here from the carrier and the client's
// number is ignored entirely.
//
// A cart is not one parcel. Items from two sellers ship from two warehouses in
// two boxes and cost two rates, so the cart is grouped by vendor and each
// group is quoted separately. Charging one rate for two parcels would lose the
// difference on every multi-vendor order.

function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// COD costs more than prepaid — the courier charges a collection fee — so the
// payment method is part of the question, not an afterthought.
const PREPAID_METHODS = ['RAZORPAY', 'WALLET'];

function isCod(paymentMethod) {
  return String(paymentMethod || '').toUpperCase() === 'COD';
}

// Where each vendor's parcel ships from. Same fallback chain the product page
// uses: the seller's registered warehouse, else the marketplace's own origin.
async function resolveOriginPincode(vendorId, settings) {
  if (vendorId) {
    const own = await PickupLocation.findOne({
      vendor: vendorId,
      isActive: true,
      registrationStatus: 'REGISTERED',
    })
      .sort({ isDefault: -1, createdAt: 1 })
      .select('pincode')
      .lean();

    if (own?.pincode) return own.pincode;
  }

  return settings.defaultOriginPincode || null;
}

// One vendor's parcel: what is in it, and what the courier wants for it.
async function quoteGroup({ vendorId, entries, deliveryPincode, cod, settings }) {
  const origin = await resolveOriginPincode(vendorId, settings);
  if (!origin) {
    return { ok: false, reason: 'NO_ORIGIN', vendorId };
  }

  const vendor = vendorId ? await Vendor.findById(vendorId).select('defaultPackage').lean() : null;

  // Everything from this seller travels in one box, so the package is worked
  // out from the whole group — not per line.
  const pkg = await suggestPackage(
    entries.map((entry) => ({ quantity: entry.quantity, product: entry.product })),
    { settings, vendorDefault: vendor?.defaultPackage || null }
  );

  const declaredValue = entries.reduce(
    (sum, entry) => sum + (entry.product.salePrice ?? entry.product.price ?? 0) * entry.quantity,
    0
  );

  const result = await serviceabilityService.checkLane({
    vendorId,
    pickupPincode: origin,
    deliveryPincode,
    weightKg: pkg.chargeableWeightKg,
    cod,
    requiresCod: cod,
    declaredValue,
    onLog: log,
  });

  if (!result.ok) {
    // The carrier could not be asked. NOT the same as "cannot be delivered".
    return { ok: false, reason: 'CARRIER_UNAVAILABLE', vendorId };
  }
  if (!result.serviceable) {
    return { ok: false, reason: 'NOT_SERVICEABLE', vendorId };
  }

  // Cheapest courier that actually quoted a price. One that reported no rate
  // is skipped rather than counted as free.
  const rated = result.couriers.filter((c) => Number.isFinite(c.estimatedCost));
  if (rated.length === 0) {
    return { ok: false, reason: 'NO_RATED_COURIER', vendorId };
  }

  const cheapest = rated.reduce((a, b) => (b.estimatedCost < a.estimatedCost ? b : a));

  return {
    ok: true,
    vendorId,
    charge: Math.round(cheapest.estimatedCost * 100) / 100,
    courierName: cheapest.courierName,
    estimatedDeliveryDays: cheapest.estimatedDeliveryDays ?? null,
    weightKg: pkg.chargeableWeightKg,
  };
}

// The whole cart.
//
// `entries` are the SAME validated cart entries computeCheckoutTotals already
// built — passed in rather than re-read, so the quote cannot be for a
// different cart than the one being priced.
async function quoteCart({ entries, address, paymentMethod, subtotal }) {
  const settings = await ShippingSettings.getSettings();

  if (!settings.shippingEnabled) {
    // Shipping turned off platform-wide. Not the buyer's problem to solve, and
    // charging them for a parcel that cannot be booked would be worse.
    return { ok: true, shippingFee: 0, freeReason: 'SHIPPING_DISABLED', groups: [] };
  }

  const deliveryPincode = String(address.pincode || '').trim();
  if (!/^\d{6}$/.test(deliveryPincode)) {
    return { ok: false, code: 'INVALID_DELIVERY_PINCODE', message: 'This address has no valid PIN code.' };
  }

  const cod = isCod(paymentMethod);
  if (cod && !settings.codEnabled) {
    return { ok: false, code: 'COD_DISABLED', message: 'Cash on delivery is not available right now.' };
  }

  // One group per seller. `null` is the platform's own catalog, which is a
  // group of its own rather than being lumped in with a seller's.
  const byVendor = new Map();
  for (const entry of entries) {
    const key = entry.product.vendor ? String(entry.product.vendor) : 'PLATFORM';
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key).push(entry);
  }

  const groups = await Promise.all(
    [...byVendor.entries()].map(([key, groupEntries]) =>
      quoteGroup({
        vendorId: key === 'PLATFORM' ? null : key,
        entries: groupEntries,
        deliveryPincode,
        cod,
        settings,
      })
    )
  );

  const undeliverable = groups.find((g) => !g.ok && g.reason === 'NOT_SERVICEABLE');
  if (undeliverable) {
    return {
      ok: false,
      code: 'NOT_SERVICEABLE',
      message: `We cannot deliver part of this order to ${deliveryPincode} yet. Try a different address.`,
    };
  }

  const failed = groups.find((g) => !g.ok);
  if (failed) {
    // A rate we could not fetch must not become a rate of zero. Blocking the
    // order is the honest outcome: the alternative is shipping something at a
    // price nobody agreed to.
    return {
      ok: false,
      code: 'SHIPPING_QUOTE_UNAVAILABLE',
      message: 'We could not work out delivery charges just now. Please try again in a moment.',
    };
  }

  // Decision: each parcel costs what it costs, and they add up. One rate for
  // two boxes loses the difference on every multi-vendor order.
  const carrierTotal = Math.round(groups.reduce((sum, g) => sum + g.charge, 0) * 100) / 100;

  // Free above the threshold, absorbed by the marketplace. Zero disables it.
  const threshold = Number(settings.freeShippingThreshold) || 0;
  const qualifiesFree = threshold > 0 && subtotal >= threshold;

  return {
    ok: true,
    shippingFee: qualifiesFree ? 0 : carrierTotal,
    // What it would have cost, kept even when free — this is the amount the
    // marketplace is absorbing, and it belongs in the order record.
    carrierCost: carrierTotal,
    freeReason: qualifiesFree ? 'ABOVE_THRESHOLD' : null,
    freeShippingThreshold: threshold,
    // How much more to spend to get free shipping. The single most useful
    // number to put in front of a buyer at this point.
    amountToFreeShipping: qualifiesFree || threshold <= 0 ? 0 : Math.round((threshold - subtotal) * 100) / 100,
    parcelCount: groups.length,
    estimatedDeliveryDays: groups.reduce(
      (slowest, g) => Math.max(slowest ?? 0, g.estimatedDeliveryDays ?? 0),
      null
    ) || null,
    groups: groups.map((g) => ({
      vendorId: g.vendorId,
      charge: g.charge,
      courierName: g.courierName,
      estimatedDeliveryDays: g.estimatedDeliveryDays,
    })),
  };
}

module.exports = { quoteCart, isCod, PREPAID_METHODS };
