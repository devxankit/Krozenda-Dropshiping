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

const ENDPOINTS = {
  sales: { path: '/admin/analytics/sales', fixture: salesAnalyticsFixture, schema: salesAnalyticsSchema },
  vendors: { path: '/admin/analytics/vendors', fixture: vendorAnalyticsFixture, schema: vendorAnalyticsSchema },
  catalog: { path: '/admin/analytics/catalog', fixture: catalogAnalyticsFixture, schema: catalogAnalyticsSchema },
  customers: { path: '/admin/analytics/customers', fixture: customerAnalyticsFixture, schema: customerAnalyticsSchema },
}

export function fetchAnalytics(kind, range = '30d') {
  const endpoint = ENDPOINTS[kind]
  return fetchResource({ ...endpoint, params: { range } })
}
