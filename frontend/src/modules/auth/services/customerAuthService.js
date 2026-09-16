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

// One shared endpoint for every audience — the backend files the device
// against whichever account the bearer token belongs to. deviceType tells it
// which platform the token came from: the browser is always 'web', the
// mobile apps pass 'app'.
export async function registerFcmToken(token, deviceType = 'web') {
  const { data } = await api.post('/fcm-token', { token, deviceType })
  return data
}
