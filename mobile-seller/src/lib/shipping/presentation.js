// Presentation for the 22 internal shipment statuses.
//
// One table, shared by the seller and admin panels, so a status cannot read as
// "Delivered" on one screen and "Completed" on the other. The backend's
// Config/shipping.js owns the vocabulary; this owns only how it is shown.
//
// `tone` maps onto the Badge component's tones. The rule: brand/neutral while
// nothing has gone wrong, success on a real completion, warning when a human
// should look, danger when something failed outright.

const STATUS_PRESENTATION = Object.freeze({
  PENDING: { label: 'Not shipped', tone: 'neutral' },
  READY_TO_SHIP: { label: 'Ready to ship', tone: 'brand' },
  SERVICEABILITY_CHECKED: { label: 'Couriers checked', tone: 'brand' },
  CREATING: { label: 'Creating at carrier…', tone: 'brand' },
  SHIPMENT_CREATED: { label: 'Created at carrier', tone: 'brand' },
  COURIER_ASSIGNED: { label: 'Courier assigned', tone: 'brand' },
  AWB_ASSIGNED: { label: 'AWB assigned', tone: 'brand' },
  PICKUP_SCHEDULED: { label: 'Pickup scheduled', tone: 'brand' },

  PICKED_UP: { label: 'Picked up', tone: 'accent' },
  IN_TRANSIT: { label: 'In transit', tone: 'accent' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'accent' },
  DELIVERED: { label: 'Delivered', tone: 'success' },

  NDR: { label: 'Delivery failed', tone: 'warning' },
  CANCEL_REQUESTED: { label: 'Cancellation requested', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },

  RTO_INITIATED: { label: 'Returning to seller', tone: 'warning' },
  RTO_IN_TRANSIT: { label: 'Returning to seller', tone: 'warning' },
  RTO_DELIVERED: { label: 'Returned to seller', tone: 'neutral' },

  RETURN_REQUESTED: { label: 'Return requested', tone: 'warning' },
  RETURN_PICKUP_SCHEDULED: { label: 'Return pickup scheduled', tone: 'warning' },
  RETURN_IN_TRANSIT: { label: 'Return in transit', tone: 'warning' },
  RETURN_DELIVERED: { label: 'Return received', tone: 'neutral' },

  FAILED: { label: 'Failed', tone: 'danger' },
  RECONCILIATION_REQUIRED: { label: 'Needs checking', tone: 'danger' },
})

// An unrecognised status is shown verbatim rather than hidden or guessed at —
// the same rule the backend applies to unmapped carrier statuses. If this ever
// renders a raw value, a status was added to the backend without being added
// here, and that should be visible rather than silent.
export function shipmentStatusPresentation(status) {
  return STATUS_PRESENTATION[status] || { label: status || 'Unknown', tone: 'neutral' }
}

export const shipmentStatusLabel = (status) => shipmentStatusPresentation(status).label
export const shipmentStatusTone = (status) => shipmentStatusPresentation(status).tone

// Carrier account health, for the connection card.
const INTEGRATION_PRESENTATION = Object.freeze({
  CONNECTED: { label: 'Connected', tone: 'success' },
  FAILED: { label: 'Connection failing', tone: 'danger' },
  TOKEN_EXPIRED: { label: 'Reconnect needed', tone: 'warning' },
  DISCONNECTED: { label: 'Disconnected', tone: 'neutral' },
  CONFIGURATION_REQUIRED: { label: 'Not set up', tone: 'neutral' },
})

export function integrationStatusPresentation(status) {
  return INTEGRATION_PRESENTATION[status] || { label: status || 'Unknown', tone: 'neutral' }
}

// Values from PickupLocation.REGISTRATION_STATUSES.
const PICKUP_PRESENTATION = Object.freeze({
  REGISTERED: { label: 'Registered', tone: 'success' },
  NOT_REGISTERED: { label: 'Not registered', tone: 'warning' },
  REGISTRATION_FAILED: { label: 'Registration failed', tone: 'danger' },
})

export function pickupStatusPresentation(status) {
  return PICKUP_PRESENTATION[status] || { label: status || 'Unknown', tone: 'neutral' }
}

// Carrier rates are decimal RUPEES, not paise — unlike everything else in the
// vendor panel. Using the paise formatter here would divide by 100 and quietly
// under-report every shipping cost by two orders of magnitude.
//
// A null rate means the carrier did not report one. It is never rendered as ₹0,
// because "free" and "unknown" are very different things to a seller choosing
// a courier.
export function formatCarrierRupees(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatWeightKg(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
