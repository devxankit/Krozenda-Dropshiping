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
