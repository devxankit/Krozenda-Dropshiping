import { fetchResource, mutateResource } from './mockTransport'
import { shipmentListSchema, shipmentSchema, trackingSchema } from '../../../lib/shipping/contracts'
import {
  adminCarrierAccountListSchema,
  adminShippingOverviewSchema,
  adminShippingSaveSchema,
  adminShippingSettingsSchema,
  platformConnectionSchema,
} from '../schemas/shippingSchema'

// Admin shipping API. Live end to end — there is no fixture, and there must
// not be: a mocked carrier makes a screen look finished while being untestable
// against the real thing.
//
// PATH NOTE: carrier-backed shipments are under `/admin/shipping/shipments`,
// NOT `/admin/shipments`. The latter belongs to the older Fulfilment screen,
// which derives pseudo-shipments from Order.items[].trackingNumber and is
// mounted on the bare `/admin` prefix — anything placed at /admin/shipments
// would be shadowed by it and silently never called.

export const fetchShippingSettings = () =>
  fetchResource({ path: '/admin/shipping/settings', schema: adminShippingSettingsSchema, live: true })

export const saveShippingSettings = (body) =>
  mutateResource({ method: 'put', path: '/admin/shipping/settings', body, schema: adminShippingSaveSchema, live: true })

export const fetchShippingOverview = () =>
  fetchResource({ path: '/admin/shipping/overview', schema: adminShippingOverviewSchema, live: true })

// Read-only by design: an admin can see that a seller's account is failing but
// cannot test, edit or re-authenticate it, because that would mean handling
// that seller's credentials (task §4, §7).
export async function fetchCarrierAccounts(query = {}) {
  const rowsPerPage = query.rowsPerPage || 20
  const tab = query.tab && query.tab !== 'all' ? query.tab.toUpperCase() : undefined

  const data = await fetchResource({
    path: '/admin/shipping/integrations',
    params: {
      page: query.page,
      limit: rowsPerPage,
      accountType: tab,
      status: query.filters?.status || undefined,
    },
    schema: adminCarrierAccountListSchema,
    live: true,
  })

  // Adapted onto the paged shape every list screen consumes. The endpoint
  // returns no per-tab counts, so the tabs carry none rather than a guess.
  return {
    items: data.items,
    page: query.page || 1,
    rowsPerPage,
    totalItems: data.total,
    totalPages: Math.max(1, Math.ceil(data.total / rowsPerPage)),
    tabCounts: {},
  }
}

// Verifies the credentials already in the server's environment. Takes NO body:
// an admin never types the platform password into a browser.
export const testPlatformConnection = () =>
  mutateResource({ path: '/admin/shipping/platform/test-connection', body: {}, schema: platformConnectionSchema, live: true })

function searchFilter(search) {
  const term = String(search || '').trim()
  if (!term) return {}
  return /^[a-f\d]{24}$/i.test(term) ? { orderId: term } : { awb: term }
}

// Same paged-shape adaptation as the seller service, against the admin route.
export async function fetchAdminShipments(query = {}) {
  const rowsPerPage = query.rowsPerPage || 20
  const tab = query.tab && query.tab !== 'all' ? String(query.tab).toUpperCase() : undefined

  const data = await fetchResource({
    path: '/admin/shipping/shipments',
    params: {
      page: query.page,
      limit: rowsPerPage,
      group: tab,
      vendorId: query.filters?.vendorId || undefined,
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
    tabCounts: Object.fromEntries(Object.entries(data.groupCounts).map(([k, v]) => [k.toLowerCase(), v])),
  }
}

export const fetchAdminShipment = (id) =>
  fetchResource({ path: `/admin/shipping/shipments/${id}`, schema: shipmentSchema, live: true })

export const fetchAdminTracking = (id) =>
  fetchResource({ path: `/admin/shipping/shipments/${id}/tracking`, schema: trackingSchema, live: true })
