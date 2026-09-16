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

// deviceType tells the backend which platform the token came from — the
// browser is always 'web', the mobile apps pass 'app'.
export async function registerFcmToken(token, deviceType = 'web') {
  const { data } = await api.post('/user/notifications/fcm-token', { token, deviceType })
  return data
}
