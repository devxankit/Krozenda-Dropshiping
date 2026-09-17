import { fetchResource, mutateResource } from '../../admin/services/mockTransport'
import {
  connectionResultSchema,
  packageSuggestionSchema,
  pickupLocationListSchema,
  pickupLocationSchema,
  serviceabilitySchema,
  shipmentListSchema,
  shipmentSchema,
  shippingIntegrationViewSchema,
  trackingRefreshSchema,
  trackingSchema,
} from '../../../lib/shipping/contracts'

// The seller's shipping API. Every call is `live: true` — there is no fixture
// for any of this, and there must not be: a mocked carrier response would let
// a screen look finished while being untestable against the real thing.
//
// Note what is NOT here. There is no endpoint that returns a carrier password,
// token or decrypted credential, because none exists on the backend either
// (task §5, §40). The only credential this module ever handles is the one the
// seller types into the connect form, which goes up and is never read back.

// ---------------------------------------------------------------------------
// Carrier account
// ---------------------------------------------------------------------------

export const fetchShippingIntegration = () =>
  fetchResource({ path: '/vendor/shipping/integration', schema: shippingIntegrationViewSchema, live: true })

// Saving and verifying are ONE call on purpose: a "save" that did not prove the
// account works would leave the seller believing they are connected.
export const connectShiprocket = (body) =>
  mutateResource({
    path: '/vendor/shipping/integration/test-connection',
    body,
    schema: connectionResultSchema,
    live: true,
  })

export const disconnectShiprocket = () =>
  mutateResource({ method: 'delete', path: '/vendor/shipping/integration', schema: null, live: true })

// ---------------------------------------------------------------------------
// Pickup locations
// ---------------------------------------------------------------------------

export const fetchPickupLocations = () =>
  fetchResource({ path: '/vendor/shipping/pickup-locations', schema: pickupLocationListSchema, live: true })

export const createPickupLocation = (body) =>
  mutateResource({ path: '/vendor/shipping/pickup-locations', body, schema: pickupLocationSchema, live: true })

export const updatePickupLocation = (id, body) =>
  mutateResource({ method: 'put', path: `/vendor/shipping/pickup-locations/${id}`, body, schema: pickupLocationSchema, live: true })

export const setDefaultPickupLocation = (id) =>
  mutateResource({ method: 'patch', path: `/vendor/shipping/pickup-locations/${id}/default`, schema: pickupLocationSchema, live: true })

export const removePickupLocation = (id) =>
  mutateResource({ method: 'delete', path: `/vendor/shipping/pickup-locations/${id}`, schema: null, live: true })

// Registers the address with the courier. A location the carrier has never
// heard of cannot ship anything, so this is a real prerequisite rather than a
// nicety — and it is a separate call because it can fail on its own (duplicate
// name, unserviceable pincode) without the saved address being wrong.
export const registerPickupLocation = (id) =>
  mutateResource({
    method: 'post',
    path: `/vendor/shipping/pickup-locations/${id}/register`,
    body: {},
    schema: pickupLocationSchema,
    live: true,
  })

// ---------------------------------------------------------------------------
// Serviceability & packaging
// ---------------------------------------------------------------------------

// Each uncached call is a real carrier request against the seller's rate limit,
// so this is only ever called from an explicit action — never from a render.
export const checkServiceability = (body) =>
  mutateResource({ path: '/vendor/shipping/serviceability', body, schema: serviceabilitySchema, live: true })

export const suggestPackage = (orderId) =>
  mutateResource({ path: '/vendor/shipping/package/suggest', body: { orderId }, schema: packageSuggestionSchema, live: true })

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

// Adapts the shipping endpoint's {items, total, groupCounts} onto the paged
// shape every other list screen consumes, so ShipmentsPage can use the shared
// useListController instead of re-implementing paging. Shape adaptation belongs
// in the service layer — nothing above it should know the two differ.
function searchFilter(search) {
  const term = String(search || '').trim()
  if (!term) return {}
  return /^[a-f\d]{24}$/i.test(term) ? { orderId: term } : { awb: term }
}

export async function fetchShipments(query = {}) {
  const rowsPerPage = query.rowsPerPage || 20
  const tab = query.tab && query.tab !== 'all' ? String(query.tab).toUpperCase() : undefined

  const data = await fetchResource({
    path: '/vendor/shipments',
    params: {
      page: query.page,
      limit: rowsPerPage,
      group: tab,
      // One search box, two backend filters. An order id is a 24-character
      // hex ObjectId; anything else is treated as an AWB. Sending a non-id to
      // `orderId` would just be ignored server-side, so the routing is here
      // rather than asking the seller which kind of code they are pasting.
      ...searchFilter(query.filters?.search),
    },
    schema: shipmentListSchema,
    live: true,
  })

  return {
    items: data.items,
    page: query.page || 1,
    rowsPerPage,
    totalItems: data.total,
    totalPages: Math.max(1, Math.ceil(data.total / rowsPerPage)),
    // Lower-cased to match the tab ids the list screen uses.
    tabCounts: Object.fromEntries(Object.entries(data.groupCounts).map(([k, v]) => [k.toLowerCase(), v])),
  }
}

// The same shipment is reachable on two prefixes, and which one a caller must
// use depends on WHO they are: a vendor token is rejected by the admin routes
// and vice versa. The drawer that shows a shipment is shared between both
// panels, so the prefix is a parameter rather than a constant.
//
// Admin is `/admin/shipping/shipments`, NOT `/admin/shipments` — that path
// belongs to the older Fulfilment screen and is mounted first, so anything
// placed there would be shadowed.
const SHIPMENT_BASE = {
  vendor: '/vendor/shipments',
  admin: '/admin/shipping/shipments',
}

const base = (scope) => SHIPMENT_BASE[scope] || SHIPMENT_BASE.vendor

export const fetchShipment = (id, scope = 'vendor') =>
  fetchResource({ path: `${base(scope)}/${id}`, schema: shipmentSchema, live: true })

// `idempotencyKey` is sent in the BODY rather than a header: a WebView client
// cannot always set custom headers, and the backend accepts either (task §31).
// Without it, a double-tap on a slow connection creates two parcels.
export const createShipment = (body) =>
  mutateResource({ path: '/vendor/shipments', body, schema: shipmentSchema, live: true })

export const assignAwb = (id, body = {}, scope = 'vendor') =>
  mutateResource({ path: `${base(scope)}/${id}/awb`, body, schema: shipmentSchema, live: true })

// The courier's shipment cancel is ASYNCHRONOUS: a success here means the
// request was accepted, and the parcel sits at CANCEL_REQUESTED until a webhook
// confirms it. The UI must not claim it is cancelled.
export const cancelShipment = (id, body = {}, scope = 'vendor') =>
  mutateResource({ path: `${base(scope)}/${id}/cancel`, body, schema: shipmentSchema, live: true })

// Books a return. The response is the NEW return shipment, not the original —
// the forward parcel keeps its own AWB and history.
export const createReturn = (id, body = {}, scope = 'vendor') =>
  mutateResource({ path: `${base(scope)}/${id}/return`, body, schema: shipmentSchema, live: true })

export const schedulePickup = (id, scope = 'vendor') =>
  mutateResource({ path: `${base(scope)}/${id}/pickup`, body: {}, schema: shipmentSchema, live: true })

// Reads the stored timeline. Does NOT call the carrier — see refreshTracking.
export const fetchTracking = (id, scope = 'vendor') =>
  fetchResource({ path: `${base(scope)}/${id}/tracking`, schema: trackingSchema, live: true })

// The explicit "ask the carrier now" action. Separate from the read above so an
// ordinary page load can never spend a carrier call.
export const refreshTracking = (id, scope = 'vendor') =>
  mutateResource({ path: `${base(scope)}/${id}/tracking/refresh`, body: {}, schema: trackingRefreshSchema, live: true })
