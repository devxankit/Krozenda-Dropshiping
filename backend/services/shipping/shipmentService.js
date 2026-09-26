const mongoose = require('mongoose');
const Order = require('../../Models/Order');
const Product = require('../../Models/Product');
const Vendor = require('../../Models/Vendor');
const Shipment = require('../../Models/Shipment');
const PickupLocation = require('../../Models/PickupLocation');
const { resolveShippingIntegration, resolveForShipment, toAccountSnapshot } = require('./shippingAccountResolver');
const shiprocketService = require('./shiprocketService');
const serviceabilityService = require('./serviceabilityService');
const { suggestPackage, buildPackageSnapshot, validatePackage } = require('../../utils/packaging');
const { BUYER_FACING_ORDER_STATUS } = require('../../Config/shipping');
const { createNotification } = require('../../Controllers/notificationController');
const { toPaise, allocateProportional } = require('../../utils/money');
const { lineDiscountsPaise, lineGrossPaise } = require('../../utils/orderLines');

// What this parcel is worth to the buyer, so a COD courier collects the right
// amount: its lines, less their coupon share, plus their share of the order's
// delivery charge and platform fee. Shares are split by line value across the
// order's live lines with an exact largest-remainder split, so the parcels of
// a multi-seller order add up to the order total to the paise. Collecting only
// the item value (as this used to) left the delivery charge unpaid on every
// COD order.
function parcelMoney(order, myItems) {
  const indexes = myItems.map((item) => order.items.indexOf(item));
  const discounts = lineDiscountsPaise(order);
  const live = order.items.map((item, index) => index).filter((index) => order.items[index].status !== 'CANCELLED');
  const weights = live.map((index) => lineGrossPaise(order.items[index]));
  const shipping = allocateProportional(toPaise(order.shippingFee || 0), weights);
  const fee = allocateProportional(toPaise(order.platformFee || 0), weights);
  const position = new Map(live.map((index, k) => [index, k]));

  let subTotal = 0;
  let discount = 0;
  let shippingShare = 0;
  let feeShare = 0;
  for (const index of indexes) {
    subTotal += lineGrossPaise(order.items[index]);
    discount += discounts[index] || 0;
    const k = position.get(index);
    if (k !== undefined) {
      shippingShare += shipping[k];
      feeShare += fee[k];
    }
  }
  return {
    subTotal: subTotal / 100,
    discount: discount / 100,
    shipping: shippingShare / 100,
    platformFee: feeShare / 100,
    total: Math.max(0, subTotal - discount + shippingShare + feeShare) / 100,
  };
}

// The shipment lifecycle: create -> AWB -> pickup.
//
// THE HARD PART IS NOT THE HAPPY PATH. It is that Shiprocket and MongoDB
// cannot share a transaction, so every carrier call has three outcomes, not
// two (task §38):
//
//   success -> the carrier acted, we know it, record it
//   failure -> the carrier did not act, we know it, record that
//   TIMEOUT -> the carrier MAY have acted and we do not know
//
// The third is the one that creates duplicate parcels and duplicate invoices
// when it is treated as a failure and retried. So: the local Shipment row is
// written BEFORE the carrier is called, a timeout moves it to
// RECONCILIATION_REQUIRED, and nothing retries it automatically. A human or
// the reconcile() path resolves it by asking the carrier what actually
// happened.

const BLOCKED_ORDER_STATUSES = ['CANCELLED'];

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

// Structured log. Never receives a credential — callers pass ids only.
function log(entry) {
  if (!entry?.event) return;
  console.log(JSON.stringify({ scope: 'SHIPPING', at: new Date().toISOString(), ...entry }));
}

// ---------------------------------------------------------------------------
// Order status synchronisation  (task §14)
// ---------------------------------------------------------------------------
// Three statuses are kept deliberately separate:
//
//   Shipment.internalStatus  the fine-grained carrier lifecycle (22 states)
//   Order.items[].status     what the BUYER sees for that line (5 states)
//   Order.status             the aggregate across the whole order
//
// This collapses the first onto the second, then recomputes the third. It
// never widens Order.STATUSES — doing so would ripple through the admin,
// vendor and buyer panels for no benefit.
async function syncOrderFromShipment(shipment) {
  // A return parcel's progress belongs to its ReturnRequest (the Shipment
  // save hook marks it received). Mirrored onto the order it would overwrite
  // the delivered line's AWB with the return's, and a cancelled pickup would
  // mark an item the buyer received as CANCELLED.
  if (shipment.shipmentType === 'RETURN') return null;
  const buyerStatus = BUYER_FACING_ORDER_STATUS[shipment.internalStatus];
  if (!buyerStatus) return null;

  const order = await Order.findById(shipment.order);
  if (!order) return null;
  // A cancelled order's lines stay as they are: the carrier confirming the
  // cancel (CANCEL_REQUESTED reads as "in the courier's hands") must not
  // turn them into SHIPPED.
  if (order.status === 'CANCELLED') return order;

  const shippedProductIds = new Set(shipment.items.map((i) => String(i.product)));
  let changed = false;

  for (const item of order.items) {
    if (!shippedProductIds.has(String(item.product))) continue;
    // A cancelled line is not dragged back into the flow by a stray carrier
    // event on a shipment that also contained it.
    if (item.status === 'CANCELLED') continue;
    if (item.status === buyerStatus) continue;

    item.status = buyerStatus;
    item.statusHistory.push({ status: buyerStatus, at: new Date() });
    changed = true;
  }

  // Mirror the AWB and courier onto the line items, because the existing
  // vendor and admin screens already read them from there.
  if (shipment.awbCode || shipment.courierName) {
    for (const item of order.items) {
      if (!shippedProductIds.has(String(item.product))) continue;
      if (shipment.awbCode && item.trackingNumber !== shipment.awbCode) {
        item.trackingNumber = shipment.awbCode;
        changed = true;
      }
      if (shipment.courierName && item.courierName !== shipment.courierName) {
        item.courierName = shipment.courierName;
        changed = true;
      }
    }
  }

  // The order-level aggregate. "Partially shipped" has no representation in
  // the 5-value enum, so the order sits at the LEAST advanced state among its
  // live lines — an order is not DELIVERED until every line is.
  const live = order.items.filter((i) => i.status !== 'CANCELLED');
  if (live.length > 0) {
    const RANK = { PENDING: 0, PROCESSING: 1, SHIPPED: 2, DELIVERED: 3 };
    const lowest = live.reduce(
      (acc, i) => (RANK[i.status] < RANK[acc] ? i.status : acc),
      'DELIVERED'
    );
    if (order.status !== lowest && order.status !== 'CANCELLED') {
      order.status = lowest;
      order.statusHistory.push({ status: lowest, at: new Date() });
      if (lowest === 'DELIVERED' && !order.deliveredAt) order.deliveredAt = new Date();
      changed = true;
    }
  } else if (order.status !== 'CANCELLED') {
    // Every line cancelled.
    order.status = 'CANCELLED';
    order.statusHistory.push({ status: 'CANCELLED', at: new Date() });
    changed = true;
  }

  if (changed) await order.save();
  return order;
}

// ---------------------------------------------------------------------------
// Pre-flight validation
// ---------------------------------------------------------------------------
// Everything that must be true before a parcel may be created. Returns the
// gathered context on success so the caller does not re-query.
async function validateShipmentPreconditions({ orderId, vendorId, pickupLocationId, confirmedPackage }) {
  if (!mongoose.isValidObjectId(orderId)) {
    return fail('INVALID_ORDER_ID', 'Invalid order id');
  }

  // Caller input first, so a malformed package is never reported as a config
  // problem (the ordering bug fixed in serviceabilityService).
  if (confirmedPackage) {
    const errors = validatePackage(confirmedPackage);
    if (errors.length) return fail('INVALID_PACKAGE', errors[0], { errors });
  }

  const order = await Order.findById(orderId);
  if (!order) return fail('ORDER_NOT_FOUND', 'Order not found');

  if (BLOCKED_ORDER_STATUSES.includes(order.status)) {
    return fail('ORDER_NOT_SHIPPABLE', `This order is ${order.status.toLowerCase()} and cannot be shipped.`);
  }

  // An online order that was never paid must not ship. COD is the exception —
  // that is the whole point of COD (task §47: payment success !== shipment).
  if (order.paymentMethod !== 'COD' && order.paymentStatus !== 'PAID') {
    return fail(
      'ORDER_NOT_PAID',
      'This order has not been paid for yet, so it cannot be shipped.'
    );
  }

  const myItems = order.items.filter(
    (item) => String(item.vendor || '') === String(vendorId || '') && item.status !== 'CANCELLED'
  );
  if (myItems.length === 0) {
    return fail('NO_ITEMS_FOR_VENDOR', 'This order has no shippable items belonging to you.');
  }

  const address = order.shippingAddress;
  if (!address?.pincode || !/^\d{6}$/.test(String(address.pincode))) {
    return fail('INVALID_DELIVERY_ADDRESS', 'This order has no valid delivery PIN code.');
  }
  if (!address.phone || !address.line1 || !address.city) {
    return fail('INVALID_DELIVERY_ADDRESS', 'This order is missing part of its delivery address.');
  }

  const resolution = await resolveShippingIntegration({
    vendorId,
    pickupLocationId,
    operation: 'CREATE_SHIPMENT',
    requirePickupLocation: true,
  });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  const pickup = resolution.pickupLocation;

  // Shiprocket identifies a pickup point by a nickname that must already exist
  // in the account. Shipping from an unregistered location fails at the
  // carrier with an unhelpful error, so it is caught here instead.
  if (pickup.registrationStatus !== 'REGISTERED') {
    return fail(
      'PICKUP_NOT_REGISTERED',
      `"${pickup.nickname}" is not registered with the carrier yet. Register it in your Shiprocket panel under the same nickname, then mark it registered here.`,
      { pickupLocationId: pickup._id.toString() }
    );
  }

  return { ok: true, order, myItems, resolution, pickup, address };
}

// ---------------------------------------------------------------------------
// createShipment
// ---------------------------------------------------------------------------
async function createShipment({
  orderId,
  vendorId,
  pickupLocationId = null,
  confirmedPackage = null,
  idempotencyKey = null,
  actor = 'SELLER',
}) {
  // Fast path for a retry that already completed. The unique index is still
  // the real guarantee — this only avoids redoing the work in the common case.
  if (idempotencyKey) {
    const existing = await Shipment.findOne({ order: orderId, idempotencyKey });
    if (existing) {
      return { ok: true, shipment: existing, alreadyExisted: true };
    }
  }

  const pre = await validateShipmentPreconditions({ orderId, vendorId, pickupLocationId, confirmedPackage });
  if (!pre.ok) return pre;

  const { order, myItems, resolution, pickup, address } = pre;
  const settings = resolution.settings;

  // --- one shipment per (order, vendor, pickup location) --------------------
  const duplicate = await Shipment.findOne({
    order: order._id,
    vendor: vendorId || null,
    pickupLocation: pickup._id,
    shipmentType: 'FORWARD',
  });
  if (duplicate) {
    return fail(
      'SHIPMENT_ALREADY_EXISTS',
      'A shipment already exists for these items from this pickup location.',
      { shipmentId: duplicate._id.toString(), shipment: duplicate }
    );
  }

  // --- package --------------------------------------------------------------
  let pkg;
  if (confirmedPackage) {
    // Recomputed from L/B/H/actual only; the client's own weight figures are
    // discarded (task §48).
    pkg = buildPackageSnapshot(confirmedPackage, settings.volumetricDivisor);
  } else {
    const [products, vendor] = await Promise.all([
      Product.find({ _id: { $in: myItems.map((i) => i.product) } }).select('weight dimensions sku variants._id variants.weight').lean(),
      vendorId ? Vendor.findById(vendorId).select('defaultPackage').lean() : null,
    ]);
    const productById = new Map(products.map((p) => [String(p._id), p]));
    pkg = await suggestPackage(
      myItems.map((item) => ({
        quantity: item.quantity,
        product: productById.get(String(item.product)) || {},
        variantId: item.variantId,
      })),
      { settings, vendorDefault: vendor?.defaultPackage || null }
    );
  }

  const isCod = order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID';
  const linesValue = myItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const money = parcelMoney(order, myItems);

  // --- write the local row FIRST -------------------------------------------
  // This is what makes a timeout survivable: if the process dies between here
  // and the carrier responding, there is still a record saying a create was
  // attempted.
  let shipment;
  try {
    shipment = await Shipment.create({
      order: order._id,
      vendor: vendorId || null,
      customer: order.user,
      items: myItems.map((item) => ({
        product: item.product,
        name: item.name,
        sku: '',
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      shipmentType: 'FORWARD',
      pickupLocation: pickup._id,
      pickupLocationName: pickup.shiprocketLocationName || pickup.nickname,
      pickupAddress: {
        contactName: pickup.contactName,
        phone: pickup.phone,
        email: pickup.email,
        line1: pickup.addressLine1,
        line2: pickup.addressLine2,
        city: pickup.city,
        state: pickup.state,
        pincode: pickup.pincode,
        country: pickup.country,
      },
      deliveryAddress: {
        contactName: address.fullName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India',
      },
      // Immutable record of which carrier account this belongs to (task §46).
      account: toAccountSnapshot(resolution),
      package: pkg,
      paymentMethod: isCod ? 'COD' : 'PREPAID',
      // Everything the buyer owes for this parcel, delivery included.
      collectableAmount: isCod ? money.total : 0,
      declaredValue: Math.round(linesValue * 100) / 100,
      // Apportioned later once the carrier's real cost is known; the buyer's
      // charge stays an order-level figure until rate-based checkout lands.
      customerShippingCharge: 0,
      idempotencyKey,
      internalStatus: 'PENDING',
    });
  } catch (err) {
    if (err.code === 11000) {
      // Lost a race with a concurrent identical submission. The winner's row
      // is what the caller should get back.
      const winner = await Shipment.findOne({
        order: order._id,
        ...(idempotencyKey ? { idempotencyKey } : { vendor: vendorId || null, pickupLocation: pickup._id, shipmentType: 'FORWARD' }),
      });
      if (winner) return { ok: true, shipment: winner, alreadyExisted: true };
      return fail('SHIPMENT_ALREADY_EXISTS', 'A shipment for these items is already being created.');
    }
    throw err;
  }

  shipment.applyStatus('READY_TO_SHIP', { source: actor });
  shipment.applyStatus('CREATING', { source: actor, note: 'Carrier create call in flight' });
  await shipment.save();

  // --- call the carrier ------------------------------------------------------
  const payload = buildCreateOrderPayload({ order, shipment, myItems, pickup, address, isCod, money });

  try {
    const { body } = await shiprocketService.createOrder(resolution.integration, payload, { onLog: log });

    const carrierOrderId = body?.order_id ?? body?.data?.order_id;
    const carrierShipmentId = body?.shipment_id ?? body?.data?.shipment_id;

    if (!carrierOrderId && !carrierShipmentId) {
      // A 2xx with no identifiers is not a success we can act on — without a
      // shipment id there is nothing to assign an AWB to.
      shipment.applyStatus('FAILED', { source: 'SYSTEM', note: 'Carrier returned no shipment identifiers' });
      shipment.errorMessage = 'Shiprocket accepted the order but returned no shipment id.';
      await shipment.save();
      return fail('CARRIER_NO_IDENTIFIERS', shipment.errorMessage, { shipment });
    }

    shipment.shiprocketOrderId = carrierOrderId ? String(carrierOrderId) : null;
    shipment.shiprocketShipmentId = carrierShipmentId ? String(carrierShipmentId) : null;
    shipment.applyStatus('SHIPMENT_CREATED', { source: actor });
    shipment.errorMessage = '';
    await shipment.save();

    log({
      event: 'SHIPROCKET_ORDER_CREATED',
      shipmentId: String(shipment._id),
      orderId: String(order._id),
      vendorId: String(vendorId || ''),
      accountType: resolution.accountType,
      carrierShipmentId: shipment.shiprocketShipmentId,
    });

    await syncOrderFromShipment(shipment);
    return { ok: true, shipment };
  } catch (err) {
    // THE IMPORTANT BRANCH. A timeout means we do not know whether Shiprocket
    // created the order. Retrying would risk a second parcel and a second
    // invoice, so this stops and asks for reconciliation instead.
    if (err.isTimeout) {
      shipment.applyStatus('RECONCILIATION_REQUIRED', {
        source: 'SYSTEM',
        note: 'Carrier create timed out — the order may or may not exist at Shiprocket',
      });
      shipment.reconciliationRequired = true;
      shipment.reconciliationNote =
        'The create request timed out. Check Shiprocket for an order with reference ' +
        buildCarrierReference(shipment) +
        ' before retrying, or this will create a duplicate parcel.';
      shipment.errorMessage = 'Shiprocket did not respond in time.';
      await shipment.save();

      log({
        event: 'SHIPROCKET_ORDER_CREATE_TIMEOUT',
        shipmentId: String(shipment._id),
        carrierReference: buildCarrierReference(shipment),
      });

      return fail(
        'RECONCILIATION_REQUIRED',
        'Shiprocket did not respond in time. This shipment needs to be checked before retrying, so a duplicate parcel is not created.',
        { shipment }
      );
    }

    shipment.applyStatus('FAILED', { source: 'SYSTEM', note: err.code || 'CARRIER_ERROR' });
    shipment.errorMessage = safeCarrierMessage(err);
    shipment.retryCount += 1;
    await shipment.save();

    log({
      event: 'SHIPROCKET_ORDER_CREATE_FAILED',
      shipmentId: String(shipment._id),
      code: err.code,
      status: err.status,
    });

    return fail('CARRIER_ERROR', shipment.errorMessage, { shipment });
  }
}

// The reference we give Shiprocket for our own order. Includes the shipment id
// so a multi-vendor order's parcels are distinguishable in the carrier panel —
// using the bare order id would collide across sellers.
function buildCarrierReference(shipment) {
  return `KRZ-${String(shipment.order).slice(-8)}-${String(shipment._id).slice(-6)}`.toUpperCase();
}

// Builds the create/adhoc body.
//
// The ENDPOINT is verified. These FIELD NAMES come from Shiprocket's
// documented create/adhoc contract; confirm them against the official Postman
// collection before going live, and note that Shiprocket validates strictly —
// a missing billing field is rejected outright rather than defaulted.
function buildCreateOrderPayload({ order, shipment, myItems, pickup, address, isCod, money }) {
  const [firstName, ...rest] = String(address.fullName || '').trim().split(/\s+/);

  return {
    order_id: buildCarrierReference(shipment),
    order_date: new Date(order.createdAt).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: pickup.shiprocketLocationName || pickup.nickname,

    billing_customer_name: firstName || 'Customer',
    billing_last_name: rest.join(' ') || '',
    billing_address: address.line1,
    billing_address_2: address.line2 || '',
    billing_city: address.city,
    billing_pincode: address.pincode,
    billing_state: address.state,
    billing_country: address.country || 'India',
    billing_email: '',
    billing_phone: address.phone,
    shipping_is_billing: true,

    order_items: myItems.map((item) => ({
      name: item.name,
      sku: String(item.product),
      units: item.quantity,
      selling_price: item.price,
    })),

    payment_method: isCod ? 'COD' : 'Prepaid',
    // Shiprocket's order total — and the amount a COD courier collects — is
    // sub_total + shipping_charges + transaction_charges - total_discount.
    sub_total: money.subTotal,
    shipping_charges: money.shipping,
    transaction_charges: money.platformFee,
    total_discount: money.discount,

    // Dimensions in cm, weight in kg — the units Shiprocket expects.
    length: shipment.package.lengthCm,
    breadth: shipment.package.breadthCm,
    height: shipment.package.heightCm,
    weight: shipment.package.actualWeightKg,
  };
}

// Carrier errors are never shown verbatim (task §25).
// A SAFE, human message for a carrier failure. Never the raw response, never
// anything echoing a credential.
//
// `subject` names what was being attempted, because this is shared by every
// carrier operation — telling a seller "could not create the shipment" when
// they were registering a warehouse sends them looking in the wrong place.
function safeCarrierMessage(err, subject = 'shipment') {
  switch (err.code) {
    case 'SHIPROCKET_UNAUTHORIZED':
      return 'The carrier account rejected this request. Reconnect the Shiprocket account and try again.';
    case 'SHIPROCKET_TIMEOUT':
      return 'Shiprocket did not respond in time.';
    case 'SHIPROCKET_CAPABILITY_UNVERIFIED':
      return err.message;
    default:
      if (err.status === 422 || err.status === 400) {
        let rawMsg = err.message || '';
        try {
          // Shiprocket often returns JSON strings like {"address":["Address line 1 can't be less than 10 characters."]}
          const parsed = JSON.parse(rawMsg);
          if (parsed && typeof parsed === 'object') {
            const extracted = [];
            for (const key of Object.keys(parsed)) {
              const val = parsed[key];
              if (Array.isArray(val)) {
                extracted.push(...val);
              } else if (typeof val === 'string') {
                extracted.push(val);
              }
            }
            if (extracted.length > 0) {
              return extracted.join(' ');
            }
          }
        } catch (_) {}
        return `Shiprocket rejected the ${subject}: ${rawMsg}`;
      }
      return `Could not complete the ${subject} with Shiprocket. Please try again.`;
  }
}

// ---------------------------------------------------------------------------
// assignAwb
// ---------------------------------------------------------------------------
async function assignAwb({ shipmentId, vendorId = null, courierId = null, actor = 'SELLER' }) {
  const shipment = await loadOwnedShipment(shipmentId, vendorId);
  if (!shipment.ok) return shipment;
  const doc = shipment.shipment;

  if (!doc.shiprocketShipmentId) {
    return fail('NOT_CREATED_AT_CARRIER', 'This shipment has not been created with the carrier yet.');
  }
  if (doc.awbCode) {
    // Already has one. Assigning again can mint a second AWB and orphan the
    // first, so this is a no-op rather than a retry.
    return { ok: true, shipment: doc, alreadyExisted: true };
  }
  if (doc.reconciliationRequired) {
    return fail('RECONCILIATION_REQUIRED', doc.reconciliationNote || 'This shipment needs reconciling first.');
  }

  const resolution = await resolveForShipment(doc, { operation: 'ASSIGN_AWB' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  // Pick a courier when the caller did not. MANUAL strategy means the caller
  // MUST choose — we never silently pick on their behalf.
  let chosenCourierId = courierId;
  let quotedRate = null;
  if (!chosenCourierId) {
    const rates = await serviceabilityService.checkLane({
      vendorId: doc.vendor,
      pickupPincode: doc.pickupAddress.pincode,
      deliveryPincode: doc.deliveryAddress.pincode,
      weightKg: doc.package.chargeableWeightKg,
      cod: doc.paymentMethod === 'COD',
      declaredValue: doc.declaredValue,
      requiresCod: doc.paymentMethod === 'COD',
      onLog: log,
    });

    if (rates.ok && rates.recommended) {
      chosenCourierId = rates.recommended.courierId;
      // The AWB response carries no price (confirmed against the official
      // collection's "Generate AWB for Shipment" sample), so the quote we were
      // just given for this courier is the only figure available at booking
      // time. It is an ESTIMATE: Shiprocket re-bills after it weighs the
      // parcel, and that correction arrives in the billing statement, not here.
      quotedRate = Number.isFinite(rates.recommended.rate) ? rates.recommended.rate : null;
    } else if (rates.ok && !rates.serviceable) {
      return fail('NOT_SERVICEABLE', 'No courier currently serves this route.');
    } else if (rates.ok && !rates.recommended) {
      return fail(
        'COURIER_SELECTION_REQUIRED',
        doc.paymentMethod === 'COD'
          ? 'No available courier supports cash on delivery for this route. Choose one manually or change the payment method.'
          : 'Choose a courier for this shipment.'
      );
    }
    // rates.ok === false: fall through and let Shiprocket pick its own
    // default, rather than blocking the seller because a rate lookup failed.
  }

  try {
    const { body } = await shiprocketService.assignAWB(
      resolution.integration,
      { shipmentId: doc.shiprocketShipmentId, courierId: chosenCourierId },
      { onLog: log }
    );

    const data = body?.response?.data || body?.data || body || {};
    const awb = data.awb_code ?? data.awb;

    if (!awb) {
      doc.errorMessage = 'Shiprocket did not return an AWB for this shipment.';
      doc.retryCount += 1;
      await doc.save();
      return fail('AWB_NOT_RETURNED', doc.errorMessage, { shipment: doc });
    }

    doc.awbCode = String(awb);
    doc.courierId = Number(data.courier_company_id ?? chosenCourierId) || null;
    doc.courierName = data.courier_name || '';

    // The weight the carrier says it will bill on. This is the one number in
    // the AWB response that touches money, and it is worth keeping: when it
    // exceeds the weight we declared, the invoice will too.
    const appliedWeight = Number(data.applied_weight);
    if (Number.isFinite(appliedWeight) && appliedWeight > 0) {
      doc.carrierAppliedWeightKg = appliedWeight;
    }

    // What shipping costs us. The AWB response has no price field at all, so
    // this comes from the rate quoted for the chosen courier moments earlier.
    // Left null when we have no quote — a fabricated cost would silently
    // corrupt the margin figure, and null at least reads as "unknown".
    const carrierCost = Number.isFinite(Number(data.freight_charge ?? data.rate))
      ? Number(data.freight_charge ?? data.rate)
      : quotedRate;

    if (Number.isFinite(carrierCost)) {
      doc.carrierShippingCost = carrierCost;
      // Kept separate from what the buyer paid, so margin stays visible
      // (task §20). Both are snapshots at booking time.
      doc.platformShippingMargin =
        Math.round((doc.customerShippingCharge - carrierCost) * 100) / 100;
    }
    doc.applyStatus('COURIER_ASSIGNED', { source: actor });
    doc.applyStatus('AWB_ASSIGNED', { source: actor });
    doc.errorMessage = '';
    await doc.save();

    log({
      event: 'SHIPROCKET_AWB_ASSIGNED',
      shipmentId: String(doc._id),
      awb: doc.awbCode,
      courier: doc.courierName,
    });

    await syncOrderFromShipment(doc);
    return { ok: true, shipment: doc };
  } catch (err) {
    if (err.isTimeout) {
      // Same reasoning as create: an AWB may have been assigned. Retrying
      // could mint a second one.
      doc.reconciliationRequired = true;
      doc.reconciliationNote =
        'The AWB request timed out. Check Shiprocket for an AWB on shipment ' +
        doc.shiprocketShipmentId +
        ' before retrying.';
      doc.applyStatus('RECONCILIATION_REQUIRED', { source: 'SYSTEM', note: 'AWB assign timed out' });
      await doc.save();
      return fail('RECONCILIATION_REQUIRED', doc.reconciliationNote, { shipment: doc });
    }

    doc.errorMessage = safeCarrierMessage(err);
    doc.retryCount += 1;
    await doc.save();
    log({ event: 'SHIPROCKET_AWB_FAILED', shipmentId: String(doc._id), code: err.code });
    return fail('CARRIER_ERROR', doc.errorMessage, { shipment: doc });
  }
}

// ---------------------------------------------------------------------------
// schedulePickup
// ---------------------------------------------------------------------------
async function schedulePickup({ shipmentId, vendorId = null, actor = 'SELLER' }) {
  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const doc = loaded.shipment;

  if (!doc.awbCode) {
    return fail('NO_AWB', 'Assign an AWB before scheduling a pickup.');
  }
  if (doc.pickupScheduledAt) {
    return { ok: true, shipment: doc, alreadyExisted: true };
  }

  const resolution = await resolveForShipment(doc, { operation: 'SCHEDULE_PICKUP' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  try {
    const { body } = await shiprocketService.schedulePickup(
      resolution.integration,
      { shipmentIds: [doc.shiprocketShipmentId] },
      { onLog: log }
    );

    doc.applyStatus('PICKUP_SCHEDULED', { source: actor });
    const scheduledFor = body?.response?.pickup_scheduled_date || body?.pickup_scheduled_date;
    if (scheduledFor) {
      const parsed = new Date(scheduledFor);
      if (!Number.isNaN(parsed.getTime())) doc.pickupScheduledAt = parsed;
    }
    doc.errorMessage = '';
    await doc.save();

    log({ event: 'SHIPROCKET_PICKUP_SCHEDULED', shipmentId: String(doc._id), awb: doc.awbCode });

    await syncOrderFromShipment(doc);
    await notifyBuyer(doc, 'Your order has been handed to the courier.');
    return { ok: true, shipment: doc };
  } catch (err) {
    if (err.isTimeout) {
      // A pickup is far less dangerous to repeat than a create — the worst
      // case is a duplicate collection request, not a duplicate parcel. So
      // this records the failure but does NOT lock the shipment into
      // reconciliation.
      doc.errorMessage = 'The pickup request timed out. Check Shiprocket before retrying.';
      await doc.save();
      return fail('CARRIER_TIMEOUT', doc.errorMessage, { shipment: doc });
    }

    doc.errorMessage = safeCarrierMessage(err);
    doc.retryCount += 1;
    await doc.save();
    return fail('CARRIER_ERROR', doc.errorMessage, { shipment: doc });
  }
}

// ---------------------------------------------------------------------------
// Cancellation  (task 3f)
// ---------------------------------------------------------------------------
// Two different carrier calls, and picking the wrong one is the whole risk
// here. Before an AWB exists there is no shipment at the carrier, only an
// order: cancelling by AWB would do nothing and leave a live parcel the seller
// believes is dead. After an AWB exists the ORDER cancel is the wrong call.
//
// The carrier's shipment cancel is ASYNCHRONOUS (it answers 204 "cancellation
// is in progress"), so a success here means ACCEPTED, not cancelled. The
// shipment therefore moves to CANCEL_REQUESTED and only the webhook moves it
// to CANCELLED. Claiming CANCELLED on a 204 would be inventing a carrier
// outcome we have not been told.
async function cancelShipment({ shipmentId, vendorId = null, reason = '', actor = 'SELLER' }) {
  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const doc = loaded.shipment;

  if (doc.internalStatus === 'CANCELLED') {
    return { ok: true, shipment: doc, alreadyExisted: true };
  }
  if (doc.reconciliationRequired) {
    return fail(
      'RECONCILIATION_REQUIRED',
      'This shipment could not be confirmed at the carrier. Check it in Shiprocket before cancelling.'
    );
  }
  // Past the point of no return: once a courier physically has the parcel,
  // cancellation is an RTO, not a cancel, and pretending otherwise would tell
  // a seller their parcel stopped when it is still moving.
  if (!CANCELLABLE_STATUSES.includes(doc.internalStatus)) {
    return fail(
      'NOT_CANCELLABLE',
      'This parcel is already with the courier. Ask for a return (RTO) instead of a cancellation.'
    );
  }

  // Nothing was ever sent to the carrier, so there is nothing to cancel there.
  if (!doc.shiprocketOrderId && !doc.awbCode) {
    doc.applyStatus('CANCELLED', { source: actor, note: reason || 'Cancelled before dispatch' });
    doc.cancellationReason = reason || '';
    await doc.save();
    await syncOrderFromShipment(doc);
    log({ event: 'SHIPMENT_CANCELLED_LOCALLY', shipmentId: String(doc._id) });
    return { ok: true, shipment: doc, cancelledAtCarrier: false };
  }

  const resolution = await resolveForShipment(doc, { operation: 'CANCEL' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  try {
    if (doc.awbCode) {
      await shiprocketService.cancelShipment(resolution.integration, { awbs: [doc.awbCode] }, { onLog: log });
    } else {
      await shiprocketService.cancelOrder(resolution.integration, { orderIds: [doc.shiprocketOrderId] }, { onLog: log });
    }

    // ACCEPTED, not done. Only a webhook moves this to CANCELLED.
    doc.applyStatus('CANCEL_REQUESTED', { source: actor, note: reason || 'Cancellation requested' });
    doc.cancellationReason = reason || '';
    doc.errorMessage = '';
    await doc.save();

    log({
      event: 'SHIPMENT_CANCEL_REQUESTED',
      shipmentId: String(doc._id),
      awb: doc.awbCode || null,
      via: doc.awbCode ? 'AWB' : 'ORDER',
    });

    await syncOrderFromShipment(doc);
    await notifyBuyer(doc, 'Your shipment is being cancelled.');
    return { ok: true, shipment: doc, cancelledAtCarrier: true, pending: true };
  } catch (err) {
    if (err.isTimeout) {
      // A timed-out cancel is genuinely ambiguous: the carrier may or may not
      // have accepted it. Retrying a cancel is harmless (unlike a create), so
      // this does NOT lock the shipment - it just says so plainly.
      doc.errorMessage = 'The cancellation request timed out. Check Shiprocket before retrying.';
      await doc.save();
      return fail('CARRIER_TIMEOUT', doc.errorMessage, { shipment: doc });
    }

    doc.errorMessage = safeCarrierMessage(err, 'cancellation');
    await doc.save();
    return fail('CARRIER_ERROR', doc.errorMessage, { shipment: doc });
  }
}

// ---------------------------------------------------------------------------
// Returns  (task 22)
// ---------------------------------------------------------------------------
// A return is a SEPARATE shipment document pointing back at the forward one,
// never an overwrite - so the original AWB, package and costs survive for
// accounting and for support.
//
// The addresses are swapped: the buyer becomes the pickup, the seller becomes
// the delivery. Both come from the FORWARD shipment's snapshots rather than
// from live records, because the buyer may have edited their address since.
async function createReturnShipment({ shipmentId, vendorId = null, reason = '', items = null, actor = 'SELLER' }) {
  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const forward = loaded.shipment;

  if (forward.shipmentType !== 'FORWARD') {
    return fail('NOT_A_FORWARD_SHIPMENT', 'Returns are created against the original outbound parcel.');
  }
  // A parcel that never arrived cannot be returned; that is an RTO, which the
  // carrier drives on its own.
  if (forward.internalStatus !== 'DELIVERED') {
    return fail('NOT_DELIVERED', 'A return can only be raised once the parcel has been delivered.');
  }

  const existing = await Shipment.findOne({ parentShipment: forward._id, shipmentType: 'RETURN' });
  if (existing && !TERMINAL_RETURN_STATUSES.includes(existing.internalStatus)) {
    return { ok: true, shipment: existing, alreadyExisted: true };
  }

  // Either the whole parcel, or the subset the buyer is sending back. An id
  // that was not in the forward parcel is dropped rather than trusted.
  const forwardByProduct = new Map(forward.items.map((i) => [String(i.product), i]));
  const returnItems = (Array.isArray(items) && items.length
    ? items
        .map((requested) => {
          const original = forwardByProduct.get(String(requested.productId));
          if (!original) return null;
          const quantity = Math.min(Number(requested.quantity) || 0, original.quantity);
          return quantity > 0
            ? { product: original.product, name: original.name, quantity, unitPrice: original.unitPrice }
            : null;
        })
        .filter(Boolean)
    : forward.items.map((i) => ({ product: i.product, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })));

  if (returnItems.length === 0) {
    return fail('NO_RETURNABLE_ITEMS', 'None of those items are on this parcel.');
  }

  const resolution = await resolveForShipment(forward, { operation: 'CREATE_RETURN' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  const doc = await Shipment.create({
    order: forward.order,
    vendor: forward.vendor,
    customer: forward.customer,
    items: returnItems,
    shipmentType: 'RETURN',
    parentShipment: forward._id,
    // Swapped, and taken from the forward parcel's own snapshots.
    pickupAddress: forward.deliveryAddress,
    deliveryAddress: forward.pickupAddress,
    pickupLocation: forward.pickupLocation,
    pickupLocationName: forward.pickupLocationName,
    // The same carrier account that shipped it out. A return booked on a
    // different account could not be linked to the original parcel.
    account: forward.account,
    // A return travels in the same box, so the forward parcel's measured
    // package is the honest starting point.
    package: forward.package,
    // Returns are never COD: nobody collects money for a parcel coming back.
    paymentMethod: 'PREPAID',
    collectableAmount: 0,
    declaredValue: returnItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    returnReason: reason || '',
  });

  try {
    const payload = buildReturnPayload({ forward, doc, returnItems });
    const { body } = await shiprocketService.createReturn(resolution.integration, payload, { onLog: log });

    const carrierOrderId = body?.order_id ?? null;
    const carrierShipmentId = body?.shipment_id ?? null;

    if (!carrierOrderId && !carrierShipmentId) {
      doc.applyStatus('FAILED', { source: 'SYSTEM', note: 'Carrier returned no identifiers for the return' });
      await doc.save();
      return fail('CARRIER_NO_IDENTIFIERS', 'The courier did not return a reference for this return.', { shipment: doc });
    }

    doc.shiprocketOrderId = carrierOrderId ? String(carrierOrderId) : '';
    doc.shiprocketShipmentId = carrierShipmentId ? String(carrierShipmentId) : '';
    doc.applyStatus('RETURN_REQUESTED', { source: actor, note: reason || '' });
    await doc.save();

    log({
      event: 'RETURN_SHIPMENT_CREATED',
      shipmentId: String(doc._id),
      parentShipmentId: String(forward._id),
      carrierShipmentId: doc.shiprocketShipmentId || null,
    });

    await notifyBuyer(doc, 'Your return has been booked. The courier will collect it.');
    return { ok: true, shipment: doc, parent: forward };
  } catch (err) {
    if (err.isTimeout) {
      // Same reasoning as a forward create: the carrier may already have made
      // the return, so a blind retry would book a second pickup.
      doc.applyStatus('RECONCILIATION_REQUIRED', { source: 'SYSTEM', note: 'Return create timed out' });
      doc.reconciliationRequired = true;
      doc.reconciliationNote =
        'The return request timed out. Check Shiprocket for a return against ' +
        buildCarrierReference(forward) +
        ' before retrying, or this will book a second collection.';
      await doc.save();
      return fail('RECONCILIATION_REQUIRED', doc.reconciliationNote, { shipment: doc });
    }

    doc.applyStatus('FAILED', { source: 'SYSTEM', note: err.code || 'CARRIER_ERROR' });
    doc.errorMessage = safeCarrierMessage(err, 'return');
    await doc.save();
    return fail('CARRIER_ERROR', doc.errorMessage, { shipment: doc });
  }
}

// Cancel, at the carrier, every live forward parcel of an order whose items
// are all cancelled now — called after an order or a line is cancelled, so a
// courier never turns up for goods nobody is buying. Never throws: the
// cancellation itself has already happened; a carrier refusal (the parcel is
// already with the courier) is logged and alerted for a human, not undone.
async function cancelShipmentsForOrder({ orderId, reason = '', actor = 'SYSTEM' }) {
  const results = [];
  try {
    const order = await Order.findById(orderId).select('status items.product items.status').lean();
    if (!order) return results;
    const liveProducts = new Set(
      order.status === 'CANCELLED'
        ? []
        : order.items.filter((item) => item.status !== 'CANCELLED').map((item) => String(item.product))
    );
    const shipments = await Shipment.find({ order: orderId, shipmentType: 'FORWARD' });
    for (const shipment of shipments) {
      if (shipment.isTerminal() || ['CANCEL_REQUESTED', 'CANCELLED'].includes(shipment.internalStatus)) continue;
      // Still carrying something the buyer wants: leave it.
      if (shipment.items.some((item) => liveProducts.has(String(item.product)))) continue;
      const result = await cancelShipment({ shipmentId: shipment._id, reason, actor });
      results.push({ shipmentId: String(shipment._id), ok: result.ok, reason: result.code || result.reason || null });
      if (!result.ok) {
        log({ event: 'AUTO_CANCEL_SHIPMENT_FAILED', shipmentId: String(shipment._id), reason: result.code || result.reason, message: result.message });
        try {
          await require('../adminAlertService').alertAdmins({
            event: 'SHIPMENT_CANCEL_FAILED',
            title: 'Cancelled order still has a live shipment',
            message: `Order ${String(orderId).slice(-8).toUpperCase()} was cancelled, but its Shiprocket parcel could not be cancelled: ${result.message}`,
            link: `/admin/orders/detail/${orderId}`,
            key: `SHIPMENT_CANCEL_FAILED:${shipment._id}`,
            urgent: true,
          });
        } catch (alertErr) {
          log({ event: 'AUTO_CANCEL_ALERT_FAILED', shipmentId: String(shipment._id), message: alertErr.message });
        }
      }
    }
  } catch (err) {
    log({ event: 'AUTO_CANCEL_SHIPMENTS_ERROR', orderId: String(orderId), message: err.message });
  }
  return results;
}

// The return payload, in Shiprocket's own field names. Verified against the
// official Postman collection's "Create a Return Order" request.
function buildReturnPayload({ forward, doc, returnItems }) {
  const pickup = doc.pickupAddress || {};
  const delivery = doc.deliveryAddress || {};
  const pkg = doc.package || {};

  return {
    order_id: buildCarrierReference(doc),
    order_date: new Date().toISOString().slice(0, 10),

    // Pickup = the buyer, who is sending it back.
    pickup_customer_name: pickup.contactName || 'Customer',
    pickup_last_name: '',
    pickup_address: pickup.line1 || '',
    pickup_address_2: pickup.line2 || '',
    pickup_city: pickup.city || '',
    pickup_state: pickup.state || '',
    pickup_country: pickup.country || 'India',
    pickup_pincode: Number(pickup.pincode) || 0,
    pickup_email: pickup.email || '',
    pickup_phone: pickup.phone || '',
    pickup_isd_code: '91',

    // Delivery = the seller's warehouse.
    shipping_customer_name: delivery.contactName || 'Warehouse',
    shipping_last_name: '',
    shipping_address: delivery.line1 || '',
    shipping_address_2: delivery.line2 || '',
    shipping_city: delivery.city || '',
    shipping_country: delivery.country || 'India',
    shipping_pincode: Number(delivery.pincode) || 0,
    shipping_state: delivery.state || '',
    shipping_email: delivery.email || '',
    shipping_phone: delivery.phone || '',
    shipping_isd_code: '91',

    order_items: returnItems.map((item, index) => ({
      name: item.name,
      // The carrier needs a per-line identifier; the product id is the stable
      // one we have, since Order.items carries no id of its own.
      sku: `${String(item.product).slice(-12)}-${index}`,
      units: item.quantity,
      selling_price: item.unitPrice,
      qc_enable: false,
    })),

    payment_method: 'PREPAID',
    sub_total: doc.declaredValue,
    length: pkg.lengthCm || 10,
    breadth: pkg.breadthCm || 10,
    height: pkg.heightCm || 10,
    weight: pkg.actualWeightKg || 0.5,
  };
}

// States from which a cancellation still makes sense. Once a courier has the
// parcel in hand, the right instrument is an RTO, not a cancel.
const CANCELLABLE_STATUSES = [
  'PENDING',
  'READY_TO_SHIP',
  'SERVICEABILITY_CHECKED',
  'SHIPMENT_CREATED',
  'COURIER_ASSIGNED',
  'AWB_ASSIGNED',
  'PICKUP_SCHEDULED',
];

const TERMINAL_RETURN_STATUSES = ['RETURN_DELIVERED', 'CANCELLED', 'FAILED'];

// ---------------------------------------------------------------------------
// Carrier documents: shipping label, manifest, tax invoice
// ---------------------------------------------------------------------------
//
// All three are the same shape of operation — ask the carrier to render a PDF,
// keep the URL it gives back — so they share one function rather than three
// near-identical ones that would drift.
//
// Two things worth knowing:
//
//   1. The URL is CACHED on the shipment. Shiprocket bills per generation for
//      some plans and the document does not change once the parcel exists, so
//      a seller clicking "print label" four times must not spend four carrier
//      calls. `force` exists for the case where the stored URL has expired.
//
//   2. A label and a manifest are addressed by SHIPMENT id, an invoice by
//      ORDER id. Getting that backwards returns someone else's document, so
//      the table below is explicit about which identifier each one takes.
const CARRIER_DOCUMENTS = Object.freeze({
  LABEL: {
    field: 'labelUrl',
    label: 'shipping label',
    // The carrier only renders a label once a courier has been allocated.
    requiresAwb: true,
    call: (integration, doc) =>
      shiprocketService.generateLabel(integration, { shipmentIds: [doc.shiprocketShipmentId] }, { onLog: log }),
    readUrl: (body) => body?.label_url || body?.response?.label_url || null,
  },
  MANIFEST: {
    field: 'manifestUrl',
    label: 'manifest',
    requiresAwb: true,
    call: (integration, doc) =>
      shiprocketService.generateManifest(integration, { shipmentIds: [doc.shiprocketShipmentId] }, { onLog: log }),
    readUrl: (body) => body?.manifest_url || body?.response?.manifest_url || null,
  },
  INVOICE: {
    field: 'invoiceUrl',
    label: 'invoice',
    // An invoice is a document about the ORDER, and exists as soon as the
    // order reaches the carrier — no courier allocation needed.
    requiresAwb: false,
    call: (integration, doc) =>
      shiprocketService.printInvoice(integration, { orderIds: [doc.shiprocketOrderId] }, { onLog: log }),
    readUrl: (body) => body?.invoice_url || body?.response?.invoice_url || null,
  },
});

async function generateDocument({ shipmentId, vendorId = null, type, force = false, actor = 'SELLER' }) {
  const spec = CARRIER_DOCUMENTS[type];
  if (!spec) return fail('INVALID_DOCUMENT_TYPE', 'Unknown document type');

  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const doc = loaded.shipment;

  if (!doc.shiprocketOrderId) {
    return fail('NOT_CREATED_AT_CARRIER', `This parcel has not reached the courier yet, so there is no ${spec.label} to print.`);
  }
  if (spec.requiresAwb && !doc.awbCode) {
    return fail('NO_AWB', `Assign an AWB before printing the ${spec.label}.`);
  }

  // Cached — see note 1 above.
  if (doc[spec.field] && !force) {
    return { ok: true, shipment: doc, url: doc[spec.field], cached: true };
  }

  const resolution = await resolveForShipment(doc, { operation: 'GENERATE_DOCUMENT' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  try {
    const { body } = await spec.call(resolution.integration, doc);
    const url = spec.readUrl(body);

    if (!url) {
      // The call succeeded but the carrier gave us nothing to show. Reporting
      // that plainly beats saving an empty string and rendering a dead link.
      return fail('DOCUMENT_NOT_READY', `The courier could not produce a ${spec.label} for this parcel yet. Try again shortly.`);
    }

    doc[spec.field] = url;
    doc.errorMessage = '';
    await doc.save();

    log({ event: `SHIPROCKET_${type}_GENERATED`, shipmentId: String(doc._id), awb: doc.awbCode, actor });

    return { ok: true, shipment: doc, url, cached: false };
  } catch (err) {
    // Nothing is created or charged by a failed render, so unlike createShipment
    // this needs no reconciliation state — it is safe to simply retry.
    const message = safeCarrierMessage(err, spec.label);
    return fail(err.isTimeout ? 'CARRIER_TIMEOUT' : 'CARRIER_ERROR', message, { shipment: doc });
  }
}

// ---------------------------------------------------------------------------
// NDR: non-delivery reports
// ---------------------------------------------------------------------------
//
// An NDR is the courier saying "we tried and could not deliver". The seller
// then has to choose: try again, or send it back. Left unanswered, couriers
// return the parcel by default — so a seller who cannot see their NDRs is
// paying return freight on orders that a phone call would have saved.
//
// The action vocabulary is Shiprocket's own and is passed through unmapped.
// Inventing friendlier names would risk sending "return" where the seller
// asked for "re-attempt", which is an expensive thing to get wrong.
const NDR_ACTIONS = Object.freeze(['re-attempt', 'return']);

// GET the courier's NDR record for one parcel.
async function getNdr({ shipmentId, vendorId = null }) {
  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const doc = loaded.shipment;

  if (!doc.awbCode) {
    return fail('NO_AWB', 'This parcel has no AWB, so the courier has nothing to report on it.');
  }

  const resolution = await resolveForShipment(doc, { operation: 'NDR_READ' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  try {
    const { body } = await shiprocketService.getNdrByAwb(resolution.integration, doc.awbCode, { onLog: log });
    return { ok: true, shipment: doc, ndr: body ?? null };
  } catch (err) {
    return fail(err.isTimeout ? 'CARRIER_TIMEOUT' : 'CARRIER_ERROR', safeCarrierMessage(err, 'delivery report'));
  }
}

// Tell the courier what to do next with an undelivered parcel.
async function actOnNdr({ shipmentId, vendorId = null, action, comments = '', actor = 'SELLER' }) {
  if (!NDR_ACTIONS.includes(action)) {
    return fail('INVALID_NDR_ACTION', `Action must be one of: ${NDR_ACTIONS.join(', ')}`);
  }

  const loaded = await loadOwnedShipment(shipmentId, vendorId);
  if (!loaded.ok) return loaded;
  const doc = loaded.shipment;

  if (!doc.awbCode) {
    return fail('NO_AWB', 'This parcel has no AWB, so there is no delivery attempt to answer.');
  }
  // A delivered or cancelled parcel has no open attempt to answer, and the
  // carrier would reject the call anyway.
  if (['DELIVERED', 'CANCELLED'].includes(doc.internalStatus)) {
    return fail('NOT_NDR_ACTIONABLE', `This parcel is already ${doc.internalStatus.toLowerCase()}.`);
  }

  const resolution = await resolveForShipment(doc, { operation: 'NDR_ACTION' });
  if (!resolution.ok) return fail(resolution.reason, resolution.message);

  try {
    const { body } = await shiprocketService.actOnNdr(
      resolution.integration,
      { awbCode: doc.awbCode, action, comments: String(comments || '').slice(0, 500) },
      { onLog: log }
    );

    // The carrier decides what actually happens next and reports it through
    // the tracking webhook. Recording the instruction on the timeline without
    // claiming an outcome is the honest thing to store.
    doc.statusHistory.push({
      status: doc.internalStatus,
      at: new Date(),
      source: actor,
      note: `NDR action requested: ${action}${comments ? ` (${comments})` : ''}`,
    });
    await doc.save();

    log({ event: 'SHIPROCKET_NDR_ACTION', shipmentId: String(doc._id), awb: doc.awbCode, action });

    return { ok: true, shipment: doc, result: body ?? null };
  } catch (err) {
    return fail(err.isTimeout ? 'CARRIER_TIMEOUT' : 'CARRIER_ERROR', safeCarrierMessage(err, 'delivery attempt'));
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Loads a shipment and enforces ownership in one place. `vendorId` null means
// an admin caller, who may act on any shipment.
async function loadOwnedShipment(shipmentId, vendorId) {
  if (!mongoose.isValidObjectId(shipmentId)) {
    return fail('INVALID_SHIPMENT_ID', 'Invalid shipment id');
  }

  const query = { _id: shipmentId };
  // Scoped, not checked-after-load: a seller asking for another seller's
  // shipment gets "not found", which is also the correct thing to tell them.
  if (vendorId) query.vendor = vendorId;

  const shipment = await Shipment.findOne(query);
  if (!shipment) return fail('SHIPMENT_NOT_FOUND', 'Shipment not found');

  return { ok: true, shipment };
}

async function notifyBuyer(shipment, message) {
  try {
    await createNotification({
      userId: shipment.customer,
      type: 'ORDER',
      title: 'Shipment update',
      message,
      actionType: 'ORDER',
      actionRefId: shipment.order,
    });
  } catch {
    // Best effort — a notification must never fail a shipment operation.
  }
}

module.exports = {
  parcelMoney,
  createShipment,
  generateDocument,
  getNdr,
  actOnNdr,
  NDR_ACTIONS,
  CARRIER_DOCUMENTS,
  assignAwb,
  schedulePickup,
  cancelShipment,
  cancelShipmentsForOrder,
  createReturnShipment,
  buildReturnPayload,
  CANCELLABLE_STATUSES,
  syncOrderFromShipment,
  validateShipmentPreconditions,
  loadOwnedShipment,
  buildCreateOrderPayload,
  buildCarrierReference,
  safeCarrierMessage,
};
