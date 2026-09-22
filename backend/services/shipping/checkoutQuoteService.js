const PickupLocation = require('../../Models/PickupLocation');
const Vendor = require('../../Models/Vendor');
const ShippingSettings = require('../../Models/ShippingSettings');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const serviceabilityService = require('./serviceabilityService');
const cjLogisticsService = require('../cj/cjLogisticsService');
const { usdToInr } = require('../cj/cjPricing');
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

// CJ Dropshipping parcel: international freight quote from China warehouse to customer PIN.
async function quoteCjGroup({ entries, deliveryPincode, mappingsByProduct }) {
  const cjItems = [];
  let fallbackUsd = 0;

  for (const entry of entries) {
    const pId = String(entry.product._id || entry.product.id);
    const mapping = mappingsByProduct.get(pId);
    if (!mapping) continue;

    const vId = entry.variantId || entry.variant?._id || entry.variant?.id;
    const vMapping =
      mapping.variants?.find((v) => String(v.krozendaVariantId) === String(vId)) ||
      mapping.variants?.[0];

    const cjVariantId = vMapping?.cjVariantId || mapping.cjProductId;
    cjItems.push({
      cjVariantId,
      quantity: entry.quantity,
    });

    const itemShippingUsd = vMapping?.providerShippingCost || 4.49;
    fallbackUsd += itemShippingUsd * entry.quantity;
  }

  if (cjItems.length === 0) {
    return { ok: false, reason: 'NO_CJ_ITEMS', vendorId: 'CJ_DROPSHIPPING' };
  }

  try {
    const options = await cjLogisticsService.calculateFreight({
      startCountryCode: 'CN',
      endCountryCode: 'IN',
      zip: deliveryPincode,
      items: cjItems,
    });

    if (Array.isArray(options) && options.length > 0) {
      const cheapest = options[0];
      const usdPrice = cheapest.logisticPrice ?? cheapest.totalPostageFee ?? fallbackUsd;
      const inrPrice = Math.round(usdToInr(usdPrice) * 100) / 100;

      let estimatedDeliveryDays = 14;
      if (typeof cheapest.logisticAging === 'string') {
        const parts = cheapest.logisticAging.split('-');
        const maxDays = Number(parts[parts.length - 1]);
        if (Number.isFinite(maxDays) && maxDays > 0) estimatedDeliveryDays = maxDays;
      }

      return {
        ok: true,
        vendorId: 'CJ_DROPSHIPPING',
        charge: inrPrice > 0 ? inrPrice : Math.round(usdToInr(fallbackUsd || 4.49) * 100) / 100,
        courierName: cheapest.logisticName || 'CJPacket Eub',
        estimatedDeliveryDays,
        weightKg: 0.5,
      };
    }
  } catch (err) {
    log({ event: 'CJ_FREIGHT_CALCULATE_FALLBACK', error: err.message, deliveryPincode });
  }

  const fallbackInr = Math.round(usdToInr(fallbackUsd > 0 ? fallbackUsd : 4.49) * 100) / 100;
  return {
    ok: true,
    vendorId: 'CJ_DROPSHIPPING',
    charge: fallbackInr,
    courierName: 'CJPacket International',
    estimatedDeliveryDays: 14,
    weightKg: 0.5,
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

  // Separate cart items:
  // - CJ Dropshipping products ship internationally from China via CJ Logistics.
  // - Domestic products ship via Shiprocket from Indian vendor/platform warehouses.
  const productIds = entries.map((e) => e.product._id || e.product.id).filter(Boolean);
  const cjMappings = await ProductFulfillmentMapping.find({
    product: { $in: productIds },
    provider: 'CJ',
  }).lean();
  const cjMappingByProductId = new Map(cjMappings.map((m) => [String(m.product), m]));

  const cjEntries = [];
  const byVendor = new Map();
  for (const entry of entries) {
    const pId = String(entry.product._id || entry.product.id);
    if (cjMappingByProductId.has(pId)) {
      cjEntries.push(entry);
    } else {
      const key = entry.product.vendor ? String(entry.product.vendor) : 'PLATFORM';
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key).push(entry);
    }
  }

  const groupPromises = [];

  if (cjEntries.length > 0) {
    groupPromises.push(
      quoteCjGroup({
        entries: cjEntries,
        deliveryPincode,
        mappingsByProduct: cjMappingByProductId,
      })
    );
  }

  for (const [key, groupEntries] of byVendor.entries()) {
    groupPromises.push(
      quoteGroup({
        vendorId: key === 'PLATFORM' ? null : key,
        entries: groupEntries,
        deliveryPincode,
        cod,
        settings,
      })
    );
  }

  const groups = await Promise.all(groupPromises);

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
