const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Vendor = require('../../Models/Vendor');
const ShippingSettings = require('../../Models/ShippingSettings');
const { resolveShippingIntegration } = require('./shippingAccountResolver');
const shiprocketService = require('./shiprocketService');
const { suggestPackage, buildPackageSnapshot, validatePackage } = require('../../utils/packaging');

// "Can this parcel go from A to B, with which courier, at what price?"
//
// Two entry points, both landing on the same normalised answer:
//
//   checkLane()   raw pincodes + weight — a quick check, used by the
//                 seller's pickup-location screen and by admin tooling
//   checkForOrder() the real one: derives the lane, the package and the COD
//                 amount FROM THE DATABASE for one (order, vendor) pair
//
// checkForOrder exists because the weight, the declared value and the COD
// amount are all things a client must never be trusted to supply (task §7,
// §8, §48). A caller passes an orderId; everything that decides the price is
// read server-side.

// ---------------------------------------------------------------------------
// Response normalisation
// ---------------------------------------------------------------------------
// The ENDPOINT is verified against Shiprocket's published documentation:
//   GET /v1/external/courier/serviceability/
//       ?pickup_postcode&delivery_postcode&weight&cod
//
// The RESPONSE SHAPE is not documented field-by-field in the material I could
// verify, so this reader is deliberately defensive:
//
//   * every field is read through a tolerant accessor with several known
//     aliases, because Shiprocket has used more than one spelling over time
//   * a value that is absent becomes null, never 0 and never a guess — a
//     courier whose rate we cannot read is shown as "rate unavailable" rather
//     than as free shipping
//   * the raw entry is retained under `raw` so a real response can be
//     inspected and this mapping tightened
//
// If you have the official Postman collection, confirm these field names and
// delete the aliases that do not appear.

function firstDefined(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Turns one carrier entry into the shape the rest of the application uses.
// Nothing downstream ever sees a Shiprocket field name.
function normaliseCourier(entry) {
  // `rate` / `total_charge` is Shiprocket's ALL-IN figure: on a cod=1 query it
  // already contains cod_charges. Only a bare freight_charge excludes it.
  // Adding cod_charges on top of `rate` double-counted it — a ₹94,990 COD
  // parcel quoted ₹4,941 against Shiprocket's own ₹2,566 (2.5% COD fee twice).
  const allInRate = toNumber(firstDefined(entry, ['rate', 'total_charge']));
  const freightCharge = toNumber(firstDefined(entry, ['freight_charge']));
  const codCharge = toNumber(firstDefined(entry, ['cod_charges', 'cod_charge'])) ?? 0;
  const rate = allInRate ?? (freightCharge === null ? null : freightCharge + codCharge);

  return {
    courierId: toNumber(firstDefined(entry, ['courier_company_id', 'courier_id'])),
    courierName: firstDefined(entry, ['courier_name', 'courier']) || 'Unknown courier',
    // What the carrier will bill. Null means "could not read it" — callers
    // must treat that as unknown, not as zero.
    rate,
    freightCharge,
    codCharge,
    // Total the platform pays if this courier is chosen — COD fee included.
    estimatedCost: rate === null ? null : Math.round(rate * 100) / 100,
    estimatedDeliveryDays: toNumber(firstDefined(entry, ['estimated_delivery_days', 'delivery_days'])),
    estimatedDeliveryDate: firstDefined(entry, ['etd', 'estimated_delivery_date']),
    // Shiprocket answers 1/0 rather than true/false.
    supportsCod: Number(firstDefined(entry, ['cod'])) === 1,
    isSurface: Number(firstDefined(entry, ['is_surface'])) === 1,
    rating: toNumber(firstDefined(entry, ['rating'])),
    minWeightKg: toNumber(firstDefined(entry, ['min_weight'])),
    // Kept so an unexpected response can be diagnosed without a redeploy.
    raw: entry,
  };
}

function normaliseResponse(body) {
  // Shiprocket nests the list under data.available_courier_companies. The
  // fallbacks cover the flatter shapes seen in the wild.
  const list =
    body?.data?.available_courier_companies ||
    body?.available_courier_companies ||
    body?.data?.couriers ||
    [];

  if (!Array.isArray(list)) return [];
  return list.map(normaliseCourier).filter((c) => c.courierId !== null);
}

// ---------------------------------------------------------------------------
// Courier selection  (task §10: never hardcode one courier)
// ---------------------------------------------------------------------------
// Returns the courier the configured strategy would pick, or null when the
// strategy is MANUAL or nothing qualifies. Selection NEVER silently falls back
// to a blocked or COD-incapable courier.
function selectCourier(couriers, { strategy = 'RECOMMENDED', blockedCourierIds = [], requiresCod = false } = {}) {
  const blocked = new Set((blockedCourierIds || []).map(Number));

  const eligible = couriers.filter((c) => {
    if (blocked.has(c.courierId)) return false;
    // A COD parcel handed to a courier that does not collect cash is a
    // delivery that cannot complete (task §21).
    if (requiresCod && !c.supportsCod) return false;
    return true;
  });

  if (eligible.length === 0) return null;
  if (strategy === 'MANUAL') return null;

  const sorted = [...eligible];
  switch (strategy) {
    case 'CHEAPEST':
      // Couriers whose rate could not be read sort last: picking an unknown
      // price as "cheapest" would be the opposite of what was asked for.
      sorted.sort((a, b) => (a.estimatedCost ?? Infinity) - (b.estimatedCost ?? Infinity));
      break;
    case 'FASTEST':
      sorted.sort(
        (a, b) => (a.estimatedDeliveryDays ?? Infinity) - (b.estimatedDeliveryDays ?? Infinity)
      );
      break;
    case 'RECOMMENDED':
    default:
      // Shiprocket returns its own recommendation order; respect it.
      break;
  }

  return sorted[0];
}

// ---------------------------------------------------------------------------
// Rate cache
// ---------------------------------------------------------------------------
// Serviceability is read-heavy and the answer for a given lane+weight barely
// moves within a few minutes, while Shiprocket rate-limits. A small in-memory
// cache keeps a seller clicking around their shipment screen from spending the
// account's quota.
//
// Deliberately in-process and short-lived: no Redis (the audit's §86 — do not
// add infrastructure the architecture does not need), and short enough that a
// genuine rate change is picked up quickly.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const rateCache = new Map();

function cacheKey(integrationId, { pickupPincode, deliveryPincode, weightKg, cod }) {
  // Weight is bucketed to 0.5kg: quoting per-gram would make the cache useless
  // while changing nothing about which couriers serve the lane.
  const bucket = Math.ceil(Number(weightKg) * 2) / 2;
  return `${integrationId}|${pickupPincode}|${deliveryPincode}|${bucket}|${cod ? 1 : 0}`;
}

function readCache(key) {
  const entry = rateCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    rateCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  // Crude bound: drop the oldest insertion when full. A proper LRU would be
  // more precise and is not worth the code for a 500-entry cache.
  if (rateCache.size >= MAX_CACHE_ENTRIES) {
    rateCache.delete(rateCache.keys().next().value);
  }
  rateCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function clearCache() {
  rateCache.clear();
}

// ---------------------------------------------------------------------------
// checkLane — raw pincodes, no order
// ---------------------------------------------------------------------------
async function checkLane({
  vendorId = null,
  pickupPincode,
  deliveryPincode,
  weightKg,
  cod = false,
  declaredValue = 0,
  requiresCod = null,
  onLog = null,
}) {
  if (!/^\d{6}$/.test(String(pickupPincode || ''))) {
    return { ok: false, reason: 'INVALID_PICKUP_PINCODE', message: 'Enter a valid 6-digit pickup PIN code.' };
  }
  if (!/^\d{6}$/.test(String(deliveryPincode || ''))) {
    return { ok: false, reason: 'INVALID_DELIVERY_PINCODE', message: 'Enter a valid 6-digit delivery PIN code.' };
  }
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, reason: 'INVALID_WEIGHT', message: 'A package weight is required to get rates.' };
  }

  const resolution = await resolveShippingIntegration({ vendorId, operation: 'SERVICEABILITY' });
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason, message: resolution.message };
  }

  const settings = resolution.settings;
  const key = cacheKey(resolution.integrationId, { pickupPincode, deliveryPincode, weightKg: weight, cod });

  let couriers = readCache(key);
  let fromCache = true;

  if (!couriers) {
    fromCache = false;
    try {
      const { body } = await shiprocketService.checkServiceability(
        resolution.integration,
        { pickupPincode, deliveryPincode, weightKg: weight, cod, declaredValue },
        { onLog }
      );
      couriers = normaliseResponse(body);
      writeCache(key, couriers);
    } catch (err) {
      onLog?.({
        event: 'SHIPROCKET_SERVICEABILITY_FAILED',
        integrationId: String(resolution.integrationId),
        code: err.code,
        lane: `${pickupPincode}->${deliveryPincode}`,
      });
      return {
        ok: false,
        reason: 'CARRIER_ERROR',
        // The carrier's own wording is never shown to a seller (task §25).
        message:
          err.code === 'SHIPROCKET_TIMEOUT'
            ? 'Shiprocket did not respond in time. Please try again.'
            : 'Could not fetch shipping rates right now. Please try again.',
      };
    }
  }

  const needsCod = requiresCod === null ? Boolean(cod) : Boolean(requiresCod);
  const recommended = selectCourier(couriers, {
    strategy: settings.courierSelectionStrategy,
    blockedCourierIds: settings.blockedCourierIds,
    requiresCod: needsCod,
  });

  return {
    ok: true,
    // False means the lane genuinely has no courier — a real answer, not an error.
    serviceable: couriers.length > 0,
    couriers,
    recommended,
    // Surfaced separately because "no courier at all" and "no courier that
    // does COD" are different problems with different fixes (task §21).
    codAvailable: couriers.some((c) => c.supportsCod),
    strategy: settings.courierSelectionStrategy,
    accountType: resolution.accountType,
    fromCache,
    lane: { pickupPincode, deliveryPincode, weightKg: weight, cod: Boolean(cod) },
  };
}

// ---------------------------------------------------------------------------
// checkForOrder — the real path
// ---------------------------------------------------------------------------
// Everything that determines the price is derived server-side:
//
//   pickup pincode  <- the seller's own pickup location
//   delivery pincode<- the order's snapshotted shipping address
//   weight/dimensions<- the confirmed package, else the suggested one
//   COD + amount    <- the order's own payment method and this vendor's lines
//
// A client may pass a pickupLocationId and a confirmed package; both are
// validated against the authenticated seller before use.
async function checkForOrder({
  orderId,
  vendorId,
  pickupLocationId = null,
  confirmedPackage = null,
  onLog = null,
}) {
  const order = await Order.findById(orderId);
  if (!order) {
    return { ok: false, reason: 'ORDER_NOT_FOUND', message: 'Order not found.' };
  }

  // Only this vendor's lines. A multi-vendor order must never let one seller
  // see or price another's items.
  const myItems = order.items.filter(
    (item) => String(item.vendor || '') === String(vendorId || '')
  );
  if (myItems.length === 0) {
    return { ok: false, reason: 'NO_ITEMS_FOR_VENDOR', message: 'This order has no items belonging to you.' };
  }

  // The caller's own input is validated FIRST. Resolving an account before
  // this meant a malformed package surfaced as "platform account not
  // configured" — pointing the seller at a server setting when the real
  // problem was the box they had just measured.
  if (confirmedPackage) {
    const errors = validatePackage(confirmedPackage);
    if (errors.length) {
      return { ok: false, reason: 'INVALID_PACKAGE', message: errors[0], errors };
    }
  }

  const resolution = await resolveShippingIntegration({
    vendorId,
    pickupLocationId,
    operation: 'SERVICEABILITY',
    requirePickupLocation: true,
  });
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason, message: resolution.message };
  }

  const settings = resolution.settings;
  const pickup = resolution.pickupLocation;

  const deliveryPincode = order.shippingAddress?.pincode;
  if (!/^\d{6}$/.test(String(deliveryPincode || ''))) {
    return {
      ok: false,
      reason: 'INVALID_DELIVERY_PINCODE',
      message: 'This order has no valid delivery PIN code.',
    };
  }

  // --- work out the package ------------------------------------------------
  let pkg;
  if (confirmedPackage) {
    // Already validated above. RECOMPUTED here from L/B/H/actual alone — any
    // volumetric or chargeable weight the client sent is discarded (task §48).
    pkg = buildPackageSnapshot(confirmedPackage, settings.volumetricDivisor);
  } else {
    // Suggest one via the Decision-B fallback chain:
    //   product dimensions -> this vendor's default carton -> platform default
    const [products, vendor] = await Promise.all([
      Product.find({ _id: { $in: myItems.map((i) => i.product) } })
        .select('weight dimensions')
        .lean(),
      vendorId ? Vendor.findById(vendorId).select('defaultPackage').lean() : null,
    ]);
    const productById = new Map(products.map((p) => [String(p._id), p]));

    pkg = await suggestPackage(
      myItems.map((item) => ({
        quantity: item.quantity,
        product: productById.get(String(item.product)) || {},
      })),
      { settings, vendorDefault: vendor?.defaultPackage || null }
    );
  }

  // --- COD and declared value ----------------------------------------------
  // Both read from the order, never from the request.
  const isCod = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID';
  const myLinesValue = myItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const result = await checkLane({
    vendorId,
    pickupPincode: pickup.pincode,
    deliveryPincode,
    // The CHARGEABLE weight is what a courier prices on.
    weightKg: pkg.chargeableWeightKg,
    cod: isCod,
    declaredValue: myLinesValue,
    requiresCod: isCod,
    onLog,
  });

  if (!result.ok) return result;

  return {
    ...result,
    package: pkg,
    pickupLocation: {
      id: pickup._id.toString(),
      nickname: pickup.nickname,
      pincode: pickup.pincode,
      city: pickup.city,
      registrationStatus: pickup.registrationStatus,
    },
    cod: {
      required: isCod,
      // What the courier must collect. For a prepaid order this is zero.
      collectableAmount: isCod ? Math.round(myLinesValue * 100) / 100 : 0,
    },
    declaredValue: Math.round(myLinesValue * 100) / 100,
    itemCount: myItems.length,
  };
}

module.exports = {
  checkLane,
  checkForOrder,
  selectCourier,
  normaliseResponse,
  normaliseCourier,
  clearCache,
  CACHE_TTL_MS,
};
