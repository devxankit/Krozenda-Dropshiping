import { api } from '../../../lib/axios'

export async function sendCustomerOtp(mobileNumber) {
  const { data } = await api.post('/auth/send-otp', { mobileNumber })
  return data
}

export async function verifyCustomerOtp({ mobileNumber, otp, name }) {
  const { data } = await api.post('/auth/verify-otp', { mobileNumber, otp, name })
  return data
}

export async function getCustomerProfile() {
  const { data } = await api.get('/auth/me')
  return data.data
}

export async function registerFcmToken(token) {
  const { data } = await api.post('/user/notifications/fcm-token', { token })
  return data
}
