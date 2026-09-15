// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import { adminDashboardSummaryFixture, dashboardFixture } from '../fixtures/dashboard'
import { adminDashboardSummarySchema, dashboardSchema } from '../schemas/dashboardSchema'

// Both endpoints are implemented (Controllers/adminAnalyticsController.js), so
// they are `live` — they hit the API even while VITE_USE_MOCKS is on. The
// fixtures stay as the documented shape, and as the seed for the schema the
// live response is validated against.

export function fetchAdminDashboardSummary() {
  return fetchResource({
    path: '/admin/dashboard-summary',
    fixture: adminDashboardSummaryFixture,
    schema: adminDashboardSummarySchema,
    live: true,
  })
}

export function fetchDashboard(range = '30d') {
  return fetchResource({
    path: '/admin/dashboard',
    params: { range },
    fixture: dashboardFixture,
    schema: dashboardSchema,
    live: true,
  })
}
