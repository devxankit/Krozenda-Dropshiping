import { fetchResource, mutateResource } from './mockTransport'
import { shipmentListSchema } from '../../../lib/shipping/contracts'
import { adminShippingOverviewSchema, adminShippingSaveSchema, adminShippingSettingsSchema, platformConnectionSchema } from '../schemas/shippingSchema'

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
