// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'

export async function loginVendor({ email, password }) {
  const { data } = await api.post('/vendor/auth/login', { email, password })
  return data.data
}

export async function requestVendorPasswordReset({ email }) {
  const { data } = await api.post('/vendor/auth/forgot-password', { email })
  return data.data
}

export async function resetVendorPassword({ email, otp, newPassword, confirmPassword }) {
  const { data } = await api.post('/vendor/auth/reset-password', { email, otp, newPassword, confirmPassword })
  return data
}

export async function fetchVendorProfile() {
  const { data } = await api.get('/vendor/auth/me')
  return data.data.vendor
}

export async function updateVendorProfile(body) {
  const { data } = await api.put('/vendor/auth/me', body)
  return data.data.vendor
}

// POST /vendor/auth/register — the seller's own sign-up. The backend shares
// one createVendorAccount() with the admin's "onboard a partner" flow, so the
// payload here is exactly what that validator expects: a B2B account must
// carry business.businessName/businessType and a contactPerson, a B2C one
// need not. A new account comes back PENDING + isActive:false with a usable
// token, which is what lets the seller straight into the status screen to
// upload documents rather than stranding them at a "wait for approval" wall.
export async function registerVendor(payload) {
  const { data } = await api.post('/vendor/auth/register', payload)
  return data.data
}

// POST /vendor/auth/submit-for-verification — moves PENDING/REJECTED to
// UNDER_REVIEW. Deliberately separate from document upload: a seller uploads
// documents one at a time and decides for themselves when the set is complete.
export async function submitVendorForVerification() {
  const { data } = await api.post('/vendor/auth/submit-for-verification')
  return data.data.vendor
}
