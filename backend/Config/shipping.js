// Shipping domain vocabulary: the internal shipment lifecycle, and the
// translation layer between it and whatever a carrier calls things.
//
// Two rules this file exists to enforce:
//
//   1. The rest of the application speaks INTERNAL statuses only. A carrier's
//      own wording ("Pickup Generated", "RTO Acknowledged") is stored on the
//      shipment for support/debugging but never drives logic and never reaches
//      the buyer UI.
//   2. Status can only move FORWARD. Carrier webhooks arrive out of order
//      often enough that a late IN_TRANSIT event would otherwise drag a
//      DELIVERED shipment backwards — see STATUS_RANK and canTransitionTo.

const SHIPMENT_TYPES = ['FORWARD', 'RETURN'];

const SHIPMENT_STATUSES = [
  // --- pre-handover -------------------------------------------------------
  'PENDING', // shipment row exists, nothing sent to the carrier yet
  'READY_TO_SHIP', // seller has verified the package
  'SERVICEABILITY_CHECKED',
  'CREATING', // an external create call is in flight (see RECONCILIATION_REQUIRED)
  'SHIPMENT_CREATED',
  'COURIER_ASSIGNED',
  'AWB_ASSIGNED',
  'PICKUP_SCHEDULED',
  // --- in the carrier's hands --------------------------------------------
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  // --- exceptions ---------------------------------------------------------
  'NDR', // undelivered, a delivery attempt failed
  'CANCEL_REQUESTED',
  'CANCELLED',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
  'RTO_DELIVERED',
  'RETURN_REQUESTED',
  'RETURN_PICKUP_SCHEDULED',
  'RETURN_IN_TRANSIT',
  'RETURN_DELIVERED',
  'FAILED',
  // --- needs a human ------------------------------------------------------
  // Reached when an external call timed out: the carrier MAY have created the
  // shipment. Never retried blindly — reconciled first. (task §38)
  'RECONCILIATION_REQUIRED',
];

// Terminal states. Nothing moves out of these, and the tracking poller stops
// looking at them (task §24).
const TERMINAL_STATUSES = [
  'DELIVERED',
  'CANCELLED',
  'RTO_DELIVERED',
  'RETURN_DELIVERED',
  'FAILED',
];

// The 22 internal statuses are the right vocabulary for the state machine and
// the wrong one for a screen: nobody filters a list by SERVICEABILITY_CHECKED.
// These groups are what the seller and admin shipment lists actually offer as
// tabs, defined once here so the two panels cannot drift apart. Every status
// belongs to exactly one group — asserted below.
const SHIPMENT_GROUPS = Object.freeze({
  // Still ours to act on: nothing has physically moved yet.
  TO_SHIP: [
    'PENDING',
    'READY_TO_SHIP',
    'SERVICEABILITY_CHECKED',
    'CREATING',
    'SHIPMENT_CREATED',
    'COURIER_ASSIGNED',
    'AWB_ASSIGNED',
    'PICKUP_SCHEDULED',
  ],
  // In the carrier's hands.
  IN_TRANSIT: ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'],
  DELIVERED: ['DELIVERED'],
  // Needs a human: a failed delivery, a parcel coming back, a create that
  // timed out. This is the tab that should never be quietly empty.
  ATTENTION: ['NDR', 'RTO_INITIATED', 'RTO_IN_TRANSIT', 'RTO_DELIVERED', 'FAILED', 'RECONCILIATION_REQUIRED'],
  RETURNS: ['RETURN_REQUESTED', 'RETURN_PICKUP_SCHEDULED', 'RETURN_IN_TRANSIT', 'RETURN_DELIVERED'],
  CANCELLED: ['CANCEL_REQUESTED', 'CANCELLED'],
});

// A status added to the lifecycle but not to a group would silently vanish
// from every list screen. Failing at require time is far cheaper than a seller
// wondering where their parcel went.
{
  const grouped = Object.values(SHIPMENT_GROUPS).flat();
  const missing = SHIPMENT_STATUSES.filter((s) => !grouped.includes(s));
  const duplicated = grouped.filter((s, i) => grouped.indexOf(s) !== i);
  if (missing.length || duplicated.length) {
    throw new Error(
      `SHIPMENT_GROUPS must partition SHIPMENT_STATUSES exactly. ` +
        `Ungrouped: [${missing.join(', ')}]. In more than one group: [${duplicated.join(', ')}].`
    );
  }
}

// States worth polling when webhooks are quiet. Deliberately NOT every
// non-terminal state: a shipment sitting in PENDING has nothing at the carrier
// to ask about.
const POLLABLE_STATUSES = [
  'AWB_ASSIGNED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'NDR',
  'RTO_INITIATED',
  'RTO_IN_TRANSIT',
  'RETURN_PICKUP_SCHEDULED',
  'RETURN_IN_TRANSIT',
];

// Monotonic progress rank. A carrier event may only move a shipment to a rank
// STRICTLY GREATER than where it is, with two deliberate exceptions handled in
// canTransitionTo: exception branches (NDR/RTO/CANCELLED) may interrupt a
// forward journey, because they genuinely happen after IN_TRANSIT.
//
// Ranks are spaced so branches can be inserted later without renumbering.
const STATUS_RANK = Object.freeze({
  PENDING: 0,
  RECONCILIATION_REQUIRED: 5,
  READY_TO_SHIP: 10,
  SERVICEABILITY_CHECKED: 20,
  CREATING: 25,
  SHIPMENT_CREATED: 30,
  COURIER_ASSIGNED: 40,
  AWB_ASSIGNED: 50,
  PICKUP_SCHEDULED: 60,
  PICKED_UP: 70,
  IN_TRANSIT: 80,
  OUT_FOR_DELIVERY: 90,
  NDR: 95,
  DELIVERED: 100,

  CANCEL_REQUESTED: 200,
  CANCELLED: 210,

  RTO_INITIATED: 300,
  RTO_IN_TRANSIT: 310,
  RTO_DELIVERED: 320,

  RETURN_REQUESTED: 400,
  RETURN_PICKUP_SCHEDULED: 410,
  RETURN_IN_TRANSIT: 420,
  RETURN_DELIVERED: 430,

  FAILED: 500,
});

// Exception branches may interrupt the forward journey at any point, so they
// are not subject to the rank rule.
const BRANCH_ENTRY_STATUSES = [
  'NDR',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'RTO_INITIATED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
];

// Whether `next` is a legal move from `current`.
//
// This is what stops a webhook that arrives late (or twice, or out of order)
// from downgrading a shipment — task §49's "a late IN_TRANSIT must not turn
// DELIVERED back into IN_TRANSIT".
function canTransitionTo(current, next) {
  if (!SHIPMENT_STATUSES.includes(next)) return false;
  if (current === next) return false; // no-op, and a duplicate webhook
  if (TERMINAL_STATUSES.includes(current)) return false;

  // An exception can always interrupt a live shipment.
  if (BRANCH_ENTRY_STATUSES.includes(next)) return true;

  const from = STATUS_RANK[current];
  const to = STATUS_RANK[next];
  if (from === undefined || to === undefined) return false;

  // Once on the RTO or RETURN branch, progress is measured within that branch.
  return to > from;
}

// ---------------------------------------------------------------------------
// Carrier status translation
// ---------------------------------------------------------------------------
// Keys are Shiprocket's own `current_status` strings, lowercased and
// whitespace-collapsed. This map is built from observed values and Shiprocket's
// published status vocabulary; it is deliberately NOT exhaustive, because the
// carrier can introduce a status at any time.
//
// An unrecognised status is NOT guessed at and NOT allowed to change the
// shipment — mapShiprocketStatus returns null, the caller stores the raw string
// in `shiprocketStatus`, leaves `internalStatus` alone, and logs it so the gap
// surfaces instead of silently mis-driving an order.
const SHIPROCKET_STATUS_MAP = Object.freeze({
  new: 'SHIPMENT_CREATED',
  'order placed': 'SHIPMENT_CREATED',
  invoiced: 'SHIPMENT_CREATED',
  'courier assigned': 'COURIER_ASSIGNED',
  'awb assigned': 'AWB_ASSIGNED',
  'label generated': 'AWB_ASSIGNED',
  'manifest generated': 'AWB_ASSIGNED',
  'pickup scheduled': 'PICKUP_SCHEDULED',
  'pickup generated': 'PICKUP_SCHEDULED',
  'pickup queued': 'PICKUP_SCHEDULED',
  'pickup rescheduled': 'PICKUP_SCHEDULED',
  'out for pickup': 'PICKUP_SCHEDULED',
  'pickup exception': 'NDR',
  'pickup error': 'NDR',
  shipped: 'PICKED_UP',
  'picked up': 'PICKED_UP',
  'in transit': 'IN_TRANSIT',
  'reached at destination hub': 'IN_TRANSIT',
  'misroute': 'IN_TRANSIT',
  'out for delivery': 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  undelivered: 'NDR',
  'delivery delayed': 'NDR',
  'customer not available': 'NDR',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
  'rto initiated': 'RTO_INITIATED',
  'rto acknowledged': 'RTO_INITIATED',
  'rto in transit': 'RTO_IN_TRANSIT',
  'rto delivered': 'RTO_DELIVERED',
  'rto ndr': 'RTO_IN_TRANSIT',
  lost: 'FAILED',
  damaged: 'FAILED',
  'unmapped status': null,
});

function normaliseCarrierStatus(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Returns the internal status for a Shiprocket status string, or null when the
// status is unknown. Null means "do not change internalStatus" — never
// "failed", and never a guess.
function mapShiprocketStatus(raw) {
  const key = normaliseCarrierStatus(raw);
  if (!key) return null;
  return SHIPROCKET_STATUS_MAP[key] ?? null;
}

// How an internal shipment status should read to the BUYER. Shipment states
// are finer-grained than the 5-value Order.STATUSES enum the buyer app
// already renders, so this collapses them rather than widening that enum
// (which would ripple through the admin, vendor and buyer panels).
const BUYER_FACING_ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  READY_TO_SHIP: 'PROCESSING',
  SERVICEABILITY_CHECKED: 'PROCESSING',
  CREATING: 'PROCESSING',
  SHIPMENT_CREATED: 'PROCESSING',
  COURIER_ASSIGNED: 'PROCESSING',
  AWB_ASSIGNED: 'PROCESSING',
  PICKUP_SCHEDULED: 'PROCESSING',
  RECONCILIATION_REQUIRED: 'PROCESSING',
  PICKED_UP: 'SHIPPED',
  IN_TRANSIT: 'SHIPPED',
  OUT_FOR_DELIVERY: 'SHIPPED',
  NDR: 'SHIPPED',
  RTO_INITIATED: 'SHIPPED',
  RTO_IN_TRANSIT: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  // An RTO that got back to the seller is, from the buyer's point of view, a
  // delivery that never happened.
  RTO_DELIVERED: 'CANCELLED',
  CANCEL_REQUESTED: 'SHIPPED',
  CANCELLED: 'CANCELLED',
  FAILED: 'PROCESSING',
  RETURN_REQUESTED: 'DELIVERED',
  RETURN_PICKUP_SCHEDULED: 'DELIVERED',
  RETURN_IN_TRANSIT: 'DELIVERED',
  RETURN_DELIVERED: 'DELIVERED',
});

const SHIPPING_PROVIDERS = ['SHIPROCKET'];
const SHIPPING_ACCOUNT_TYPES = ['PLATFORM', 'SELLER'];
const INTEGRATION_STATUSES = [
  'CONNECTED',
  'DISCONNECTED',
  'FAILED',
  'TOKEN_EXPIRED',
  'CONFIGURATION_REQUIRED',
];

module.exports = {
  SHIPMENT_TYPES,
  SHIPMENT_STATUSES,
  TERMINAL_STATUSES,
  POLLABLE_STATUSES,
  SHIPMENT_GROUPS,
  STATUS_RANK,
  BRANCH_ENTRY_STATUSES,
  canTransitionTo,
  SHIPROCKET_STATUS_MAP,
  normaliseCarrierStatus,
  mapShiprocketStatus,
  BUYER_FACING_ORDER_STATUS,
  SHIPPING_PROVIDERS,
  SHIPPING_ACCOUNT_TYPES,
  INTEGRATION_STATUSES,
};
