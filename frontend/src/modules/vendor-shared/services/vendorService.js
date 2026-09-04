import { fetchResource } from '../../admin/services/mockTransport'
import {
  VENDOR_SETTINGS_DATA,
  VENDOR_SUMMARY_KPI,
  vendorKycDocsFixture,
  vendorOrderListFixture,
  vendorProductListFixture,
  vendorSettlementsFixture,
} from '../fixtures/vendorData'
import {
  vendorKycListSchema,
  vendorOrderListSchema,
  vendorProductListSchema,
  vendorSettlementListSchema,
  vendorSettingsSchema,
  vendorSummarySchema,
} from '../schemas/vendorSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchVendorSummary = () =>
  fetchResource({
    path: '/vendor/summary',
    fixture: () => VENDOR_SUMMARY_KPI,
    schema: vendorSummarySchema,
  })

export const fetchVendorProducts = (query) =>
  fetchResource({
    path: '/vendor/products',
    params: params(query),
    fixture: () => vendorProductListFixture(query),
    schema: vendorProductListSchema,
  })

export const fetchVendorOrders = (query) =>
  fetchResource({
    path: '/vendor/orders',
    params: params(query),
    fixture: () => vendorOrderListFixture(query),
    schema: vendorOrderListSchema,
  })

export const fetchVendorSettlements = () =>
  fetchResource({
    path: '/vendor/settlements',
    fixture: () => vendorSettlementsFixture(),
    schema: vendorSettlementListSchema,
  })

export const fetchVendorKycDocs = () =>
  fetchResource({
    path: '/vendor/kyc-documents',
    fixture: () => vendorKycDocsFixture(),
    schema: vendorKycListSchema,
  })

export const fetchVendorSettings = () =>
  fetchResource({
    path: '/vendor/settings',
    fixture: () => VENDOR_SETTINGS_DATA,
    schema: vendorSettingsSchema,
  })
