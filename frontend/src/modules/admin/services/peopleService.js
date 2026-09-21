// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
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
  vendorRazorpaySyncSchema,
  vendorSchema,
} from '../schemas/peopleSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

function toFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, value)
  })
  return formData
}

export const fetchCustomers = (query) =>
  fetchResource({
    path: '/admin/customers',
    params: params(query),
    fixture: () => customerListFixture(query),
    schema: customerListSchema,
    live: true,
  })

export async function createCustomer(payload) {
  const { data } = await api.post('/admin/customers', toFormData(payload))
  return data.data
}

export async function updateCustomerStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/customers/${id}/status`, { isActive })
  return data.data
}

const BUSINESS_TYPE_LABELS = {
  proprietorship: 'Proprietorship',
  partnership: 'Partnership',
  llp: 'LLP',
  private_limited: 'Private limited',
  public_limited: 'Public limited',
  huf: 'HUF',
  society_trust: 'Society / Trust',
  other: 'Other',
}

// The directory screen, its table and the detail drawer all read one flat
// row. Flattening happens here rather than in the screens so the nested
// API shape (business/address/bank blocks) stays in the service layer.
function toVendorRow(vendor) {
  const isRejected = vendor.verificationStatus === 'REJECTED'
  const status = isRejected || (vendor.verificationStatus === 'APPROVED' && !vendor.isActive)
    ? 'suspended'
    : vendor.isActive
      ? 'active'
      : 'pending'

  return {
    ...vendor,
    businessName: vendor.business.businessName || '',
    role:
      vendor.vendorType === 'B2B'
        ? BUSINESS_TYPE_LABELS[vendor.business.businessType] || 'Business seller'
        : 'Individual seller',
    city: vendor.address.city || '',
    state: vendor.address.state || '',
    gstin: vendor.business.gstin || null,
    pan: vendor.business.pan || null,
    phone: vendor.mobile,
    contactPersonName: vendor.contactPerson.name || '',
    bankLinked: Boolean(vendor.bank.accountNumber && vendor.bank.ifsc),
    status,
    joinedAt: vendor.createdAt,
  }
}

export const fetchVendors = (query) =>
  fetchResource({
    path: '/admin/vendors',
    params: params(query),
    fixture: () => vendorListFixture(query),
    schema: vendorListSchema,
    live: true,
  }).then((data) => ({ ...data, items: data.items.map(toVendorRow) }))

export async function createVendor(payload) {
  const { data } = await api.post('/admin/vendors', payload)
  return toVendorRow(vendorSchema.parse(data.data))
}

export async function setVendorActive({ id, isActive }) {
  const { data } = await api.patch(`/admin/vendors/${id}/active`, { isActive })
  return toVendorRow(vendorSchema.parse({ ...data.data.vendor, products: 0, orders: 0, revenue: 0 }))
}

// POST /admin/vendors/:id/razorpay/sync — idempotent: creates the Route
// linked account if it doesn't exist yet, and optionally lets an admin
// override the eligibility flag / onboarding status in the same call.
export async function syncVendorRazorpay({ vendorId, isSettlementEligible, onboardingStatus }) {
  const body = {}
  if (isSettlementEligible !== undefined) body.isSettlementEligible = isSettlementEligible
  if (onboardingStatus !== undefined) body.onboardingStatus = onboardingStatus
  const { data } = await api.post(`/admin/vendors/${vendorId}/razorpay/sync`, body)
  return vendorRazorpaySyncSchema.parse(data.data)
}

export const fetchKycQueue = (query) =>
  fetchResource({
    path: '/admin/kyc',
    params: params(query),
    fixture: () => kycQueueFixture(query),
    schema: kycQueueSchema,
    live: true,
  })

export const fetchKycApplication = (applicationId) =>
  fetchResource({
    path: `/admin/kyc/${applicationId}`,
    fixture: () => kycApplicationFixture(applicationId),
    schema: kycApplicationSchema,
    live: true,
  })

// The application-level decision (approve/reject the vendor) and the
// per-document decision are two different endpoints on the vendor resource —
// see adminVendorController.updateVendorStatus / reviewVendorDocument.
export async function decideKycApplication({ vendorId, verificationStatus, rejectionReason }) {
  const { data } = await api.patch(`/admin/vendors/${vendorId}/status`, {
    verificationStatus,
    rejectionReason,
  })
  return data.data.vendor
}

export async function decideKycDocument({ vendorId, documentId, status, rejectionReason }) {
  const { data } = await api.patch(`/admin/vendors/${vendorId}/documents/${documentId}`, {
    status,
    rejectionReason,
  })
  return data.data
}

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
