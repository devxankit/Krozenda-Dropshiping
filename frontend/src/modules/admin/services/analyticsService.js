// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import {
  catalogAnalyticsFixture,
  customerAnalyticsFixture,
  salesAnalyticsFixture,
  vendorAnalyticsFixture,
} from '../fixtures/analytics'
import {
  catalogAnalyticsSchema,
  customerAnalyticsSchema,
  salesAnalyticsSchema,
  vendorAnalyticsSchema,
} from '../schemas/analyticsSchema'

// `live` marks the endpoints the backend actually serves. Sales is
// implemented (Controllers/adminAnalyticsController.js); the other three
// still read from fixtures, so flipping VITE_USE_MOCKS is not what decides
// which screens work.
const ENDPOINTS = {
  sales: {
    path: '/admin/analytics/sales',
    fixture: salesAnalyticsFixture,
    schema: salesAnalyticsSchema,
    live: true,
  },
  vendors: { path: '/admin/analytics/vendors', fixture: vendorAnalyticsFixture, schema: vendorAnalyticsSchema },
  catalog: { path: '/admin/analytics/catalog', fixture: catalogAnalyticsFixture, schema: catalogAnalyticsSchema },
  customers: { path: '/admin/analytics/customers', fixture: customerAnalyticsFixture, schema: customerAnalyticsSchema },
}

export function fetchAnalytics(kind, range = '30d') {
  const endpoint = ENDPOINTS[kind]
  return fetchResource({ ...endpoint, params: { range } })
}

// Which of the four screens is reading real data — the shell shows this, so
// nobody mistakes a fixture for a measurement.
export function isAnalyticsLive(kind) {
  return Boolean(ENDPOINTS[kind]?.live)
}
