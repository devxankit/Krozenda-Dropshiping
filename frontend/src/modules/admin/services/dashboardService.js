// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import { adminDashboardSummaryFixture, dashboardFixture } from '../fixtures/dashboard'
import { adminDashboardSummarySchema, dashboardSchema } from '../schemas/dashboardSchema'

export function fetchAdminDashboardSummary() {
  return fetchResource({
    path: '/admin/dashboard-summary',
    fixture: adminDashboardSummaryFixture,
    schema: adminDashboardSummarySchema,
  })
}

export function fetchDashboard(range = '30d') {
  return fetchResource({
    path: '/admin/dashboard',
    params: { range },
    fixture: dashboardFixture,
    schema: dashboardSchema,
  })
}
