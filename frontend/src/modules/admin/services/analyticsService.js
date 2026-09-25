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
  revenueSchema,
  sellerRevenueSchema,
  salesAnalyticsSchema,
  vendorAnalyticsSchema,
} from '../schemas/analyticsSchema'

// `live` marks the endpoints the backend actually serves. All four are now
// implemented (Controllers/adminAnalyticsController.js) — fixtures stay
// wired as the fetch fallback, but flipping VITE_USE_MOCKS is not what
// decides whether a screen shows real figures.
const ENDPOINTS = {
  sales: {
    path: '/admin/analytics/sales',
    fixture: salesAnalyticsFixture,
    schema: salesAnalyticsSchema,
    live: true,
  },
  vendors: {
    path: '/admin/analytics/vendors',
    fixture: vendorAnalyticsFixture,
    schema: vendorAnalyticsSchema,
    live: true,
  },
  catalog: {
    path: '/admin/analytics/catalog',
    fixture: catalogAnalyticsFixture,
    schema: catalogAnalyticsSchema,
    live: true,
  },
  customers: {
    path: '/admin/analytics/customers',
    fixture: customerAnalyticsFixture,
    schema: customerAnalyticsSchema,
    live: true,
  },
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

// Revenue by channel (own stock / CJ / sellers) and by seller. Backed by
// Controllers/revenueController — the seller panel reads the same figures.
export function fetchRevenue(range = '30d') {
  return fetchResource({ path: '/admin/analytics/revenue', params: { range }, schema: revenueSchema, live: true })
}

export function fetchSellerRevenue(sellerId, range = '30d') {
  return fetchResource({
    path: `/admin/analytics/revenue/sellers/${sellerId}`,
    params: { range },
    schema: sellerRevenueSchema,
    live: true,
  })
}
