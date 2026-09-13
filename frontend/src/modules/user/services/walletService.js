// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { walletSchema, topupOrderSchema } from '../schemas/walletSchema'

export async function fetchWallet() {
  const response = await api.get('/user/wallet')
  return walletSchema.parse(response.data.data)
}

export async function createTopupOrder(amount) {
  const response = await api.post('/user/wallet/topup/order', { amount })
  return topupOrderSchema.parse(response.data.data)
}

export async function verifyTopup(payload) {
  const response = await api.post('/user/wallet/topup/verify', payload)
  return response.data.data
}
