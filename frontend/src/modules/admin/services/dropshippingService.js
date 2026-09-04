// Layer rule: services/ is the ONLY place that imports the axios instance / mockTransport.

import { fetchResource } from './mockTransport'
import {
  DROPSHIP_OVERVIEW_STATS,
  RECENT_FORWARDED_ORDERS,
  dropshipMarginRulesFixture,
  dropshipPartnerListFixture,
  dropshipProductListFixture,
  forwardedOrderListFixture,
} from '../fixtures/dropshipping'
import {
  dropshipOverviewSchema,
  dropshipPartnerListSchema,
  dropshipProductListSchema,
  forwardedOrderListSchema,
  marginRuleListSchema,
} from '../schemas/dropshippingSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchDropshipOverview = () =>
  fetchResource({
    path: '/admin/dropshipping/overview',
    fixture: () => ({
      ...DROPSHIP_OVERVIEW_STATS,
      recentOrders: RECENT_FORWARDED_ORDERS,
    }),
    schema: dropshipOverviewSchema,
  })

export const fetchDropshipPartners = (query) =>
  fetchResource({
    path: '/admin/dropshipping/partners',
    params: params(query),
    fixture: () => dropshipPartnerListFixture(query),
    schema: dropshipPartnerListSchema,
  })

export const fetchDropshipProducts = (query) =>
  fetchResource({
    path: '/admin/dropshipping/products',
    params: params(query),
    fixture: () => dropshipProductListFixture(query),
    schema: dropshipProductListSchema,
  })

export const fetchForwardedOrders = (query) =>
  fetchResource({
    path: '/admin/dropshipping/orders',
    params: params(query),
    fixture: () => forwardedOrderListFixture(query),
    schema: forwardedOrderListSchema,
  })

export const fetchDropshipMarginRules = () =>
  fetchResource({
    path: '/admin/dropshipping/margins',
    fixture: () => dropshipMarginRulesFixture(),
    schema: marginRuleListSchema,
  })
