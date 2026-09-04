// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import {
  customerListFixture,
  kycApplicationFixture,
  kycQueueFixture,
  policyAcceptanceFixture,
  roleDetailFixture,
  roleListFixture,
  staffListFixture,
  vendorListFixture,
} from '../fixtures/people'
import {
  customerListSchema,
  kycApplicationSchema,
  kycQueueSchema,
  policyAcceptanceListSchema,
  roleDetailSchema,
  roleListSchema,
  staffListSchema,
  vendorListSchema,
} from '../schemas/peopleSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

export const fetchCustomers = (query) =>
  fetchResource({
    path: '/admin/customers',
    params: params(query),
    fixture: () => customerListFixture(query),
    schema: customerListSchema,
  })

export const fetchVendors = (query) =>
  fetchResource({
    path: '/admin/vendors',
    params: params(query),
    fixture: () => vendorListFixture(query),
    schema: vendorListSchema,
  })

export const fetchKycQueue = (query) =>
  fetchResource({
    path: '/admin/kyc',
    params: params(query),
    fixture: () => kycQueueFixture(query),
    schema: kycQueueSchema,
  })

export const fetchKycApplication = (applicationId) =>
  fetchResource({
    path: `/admin/kyc/${applicationId}`,
    fixture: () => kycApplicationFixture(applicationId),
    schema: kycApplicationSchema,
  })

export const fetchPolicyAcceptances = (query) =>
  fetchResource({
    path: '/admin/policy-acceptances',
    params: params(query),
    fixture: () => policyAcceptanceFixture(query),
    schema: policyAcceptanceListSchema,
  })

export const fetchStaff = () =>
  fetchResource({ path: '/admin/staff', fixture: staffListFixture, schema: staffListSchema })

export const fetchRoles = () =>
  fetchResource({ path: '/admin/roles', fixture: roleListFixture, schema: roleListSchema })

export const fetchRoleDetail = (roleId) =>
  fetchResource({
    path: `/admin/roles/${roleId}`,
    fixture: () => roleDetailFixture(roleId),
    schema: roleDetailSchema,
  })
