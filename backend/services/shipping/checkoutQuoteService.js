const PickupLocation = require('../../Models/PickupLocation');
const Vendor = require('../../Models/Vendor');
const ShippingSettings = require('../../Models/ShippingSettings');
const ProductFulfillmentMapping = require('../../Models/ProductFulfillmentMapping');
const serviceabilityService = require('./serviceabilityService');
const { suggestPackage } = require('../../utils/packaging');
const { resolveUnitPrice } = require('../../utils/pricing');
const { fulfillmentTypeOfProvider } = require('../fulfillment/fulfillmentRouter');
const { quoteShopifyGroup } = require('./shopifyRateService');

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
const Order = require('../../Models/Order');

const PREPAID_METHODS = ['RAZORPAY', 'WALLET'];

// Which orders the marketplace's free-delivery threshold absorbs. Seller and
// own-stock parcels only: a provider's freight is priced out of the product,
// not into it, so absorbing it would sell every externally fulfilled item
// below cost (business decision, 2026-09). A set rather than an `=== STANDARD`
// test so the policy is one line to change and reads as a policy, not a quirk.
const FREE_SHIPPING_APPLIES_TO = new Set(['STANDARD']);

function round2(amount) {
  return Math.round(amount * 100) / 100;
}

// A rate of 0 for every fulfillment type the platform knows about. Built from
// the Order enum rather than written out, so a provider added there starts at
// a known zero instead of `undefined` — which the caller's completeness check
// would then read as a missing quote and block the checkout on.
function zeroRates() {
  return Object.fromEntries(Order.FULFILLMENT_TYPES.map((type) => [type, 0]));
}

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
    entries.map((entry) => ({ quantity: entry.quantity, product: entry.product, variantId: entry.variantId })),
    { settings, vendorDefault: vendor?.defaultPackage || null }
  );

  // What the buyer is actually paying for these lines — variant and bulk
  // price included. The courier's COD fee is a percentage of this, so the
  // parent product's list price here would misprice every variant.
  const declaredValue = entries.reduce(
    (sum, entry) =>
      sum +
      resolveUnitPrice(entry.product, {
        variantId: entry.variantId ? String(entry.variantId) : null,
        quantity: entry.quantity,
      }).unitPrice *
        entry.quantity,
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

// An externally fulfilled parcel: the provider ships it, so no carrier rate
// applies and Shiprocket is never asked.
//
// There is no provider wired in at the moment, so this fails closed. That is
// deliberate and is the single most important line in this file: the
// alternative — returning a charge of 0 — would ship a provider's goods
// free and show nothing in any log. A rate nobody can quote is a stop.
//
// A provider is wired in by replacing the body with its rate rules; the
// shape of the return value (ok / charge / courierName /
// estimatedDeliveryDays) is all quoteCart needs.
async function quoteExternalGroup({ entries, fulfillmentType, subtotal }) {
  if (fulfillmentType === 'SHOPIFY') {
    const quote = await quoteShopifyGroup({ entries, subtotal });
    if (!quote.ok) {
      log({ event: 'SHOPIFY_RATE_UNAVAILABLE', reason: quote.reason, lines: entries.length });
      return { ok: false, reason: quote.reason, fulfillmentType, vendorId: 'SHOPIFY' };
    }
    return {
      ok: true,
      vendorId: 'SHOPIFY',
      charge: quote.charge,
      courierName: quote.courierName,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
      weightKg: 0.5,
    };
  }

  log({ event: 'EXTERNAL_RATE_NOT_CONFIGURED', fulfillmentType, lines: entries.length });
  return { ok: false, reason: 'EXTERNAL_RATE_NOT_CONFIGURED', fulfillmentType };
}
// The whole cart.
//
// `entries` are the SAME validated cart entries computeCheckoutTotals already
// built — passed in rather than re-read, so the quote cannot be for a
// different cart than the one being priced. `fulfillmentByProduct` is the
// caller's answer to "which provider owns which line", so the quote and the
// order split can never disagree about it.
async function quoteCart({ entries, address, paymentMethod, subtotal, fulfillmentByProduct = new Map() }) {
  const settings = await ShippingSettings.getSettings();

  if (!settings.shippingEnabled) {
    // Shipping turned off platform-wide. Not the buyer's problem to solve, and
    // charging them for a parcel that cannot be booked would be worse.
    return {
      ok: true,
      shippingFee: 0,
      shippingByFulfillment: zeroRates(),
      freeReason: 'SHIPPING_DISABLED',
      groups: [],
    };
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
  // - externally fulfilled products ship from whichever provider owns them.
  // - domestic products ship via Shiprocket from Indian vendor/platform
  //   warehouses, one parcel per seller.
  //
  // Every group below is tagged with the Order.fulfillmentType it belongs to,
  // so each order's delivery charge can be summed forward per type instead of
  // being inferred by subtracting the providers we happen to know about.
  const productIds = entries.map((e) => e.product._id || e.product.id).filter(Boolean);
  const mappings = await ProductFulfillmentMapping.find({ product: { $in: productIds } })
    .select('product provider variants')
    .lean();
  const mappingByProductId = new Map(mappings.map((m) => [String(m.product), m]));

  // One bucket per externally fulfilled type, plus one per seller.
  const externalEntries = new Map();
  const byVendor = new Map();
  for (const entry of entries) {
    const pId = String(entry.product._id || entry.product.id);
    // The mapping row is consulted as well as the caller's answer, because a
    // line quoted as domestic but ordered as external would be charged
    // Shiprocket's rate for a parcel Shiprocket never sees.
    const fulfillmentType =
      fulfillmentByProduct.get(pId) ||
      (mappingByProductId.has(pId) ? fulfillmentTypeOfProvider(mappingByProductId.get(pId).provider) : 'STANDARD');

    // UNSUPPORTED lands in the external bucket, not the seller one. A product
    // naming an unregistered provider must not be quoted a domestic carrier
    // rate for a parcel that carrier will never be given.

    if (fulfillmentType !== 'STANDARD') {
      if (!externalEntries.has(fulfillmentType)) externalEntries.set(fulfillmentType, []);
      externalEntries.get(fulfillmentType).push(entry);
    } else {
      const key = entry.product.vendor ? String(entry.product.vendor) : 'PLATFORM';
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key).push(entry);
    }
  }

  const groupPromises = [];

  for (const [fulfillmentType, groupEntries] of externalEntries.entries()) {
    groupPromises.push(
      quoteExternalGroup({ entries: groupEntries, fulfillmentType, deliveryPincode, subtotal }).then((group) => ({
        ...group,
        fulfillmentType,
      }))
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
      }).then((group) => ({ ...group, fulfillmentType: 'STANDARD' }))
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
  if (failed?.reason === 'SHOPIFY_RATE_NOT_CONFIGURED' || failed?.reason === 'SHOPIFY_RATE_MODE_INVALID') {
    return {
      ok: false,
      code: 'SHOPIFY_RATE_NOT_CONFIGURED',
      message: 'Delivery charges for these items are not set up yet. Please try again shortly.',
    };
  }
  if (failed?.reason === 'EXTERNAL_MAPPING_MISSING') {
    return {
      ok: false,
      code: 'DROPSHIP_ITEM_UNAVAILABLE',
      message:
        'A dropshipping item in your cart is not available in the option you chose. Please remove it and add it again.',
    };
  }
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

  // Split by who fulfils it: a mixed cart becomes one order per provider, and
  // each order carries its own parcels' delivery charge.
  //
  // Summed FORWARD, per fulfillmentType. This used to derive the marketplace's
  // charge by subtracting the provider's from the total, which quietly assigned
  // any group it did not recognise to STANDARD — overcharging the seller
  // parcels and zeroing the provider's freight in the same stroke. A forward
  // sum can neither double-count a group nor lose one.
  const shippingByFulfillment = zeroRates();
  for (const group of groups) {
    shippingByFulfillment[group.fulfillmentType] = round2(
      (shippingByFulfillment[group.fulfillmentType] || 0) + group.charge
    );
  }

  // Free delivery covers the marketplace's own (seller) parcels only. A
  // provider's freight is always charged at cost: it is priced out of the
  // product (business decision, 2026-09), so absorbing it would sell every
  // dropship item below cost.
  if (qualifiesFree) {
    for (const type of FREE_SHIPPING_APPLIES_TO) shippingByFulfillment[type] = 0;
  }

  // The provider shipping line that was quoted, per type: the order raised
  // with the provider is created on the line the buyer actually paid for.
  const shippingLineTitleByFulfillment = {};
  for (const group of groups) {
    if (group.fulfillmentType !== 'STANDARD' && group.courierName) {
      shippingLineTitleByFulfillment[group.fulfillmentType] = group.courierName;
    }
  }

  return {
    ok: true,
    shippingFee: round2(Object.values(shippingByFulfillment).reduce((sum, charge) => sum + charge, 0)),
    shippingByFulfillment,
    shippingLineTitleByFulfillment,
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
      fulfillmentType: g.fulfillmentType,
      charge: g.charge,
      courierName: g.courierName,
      estimatedDeliveryDays: g.estimatedDeliveryDays,
    })),
  };
}

module.exports = { quoteCart, isCod, PREPAID_METHODS };
