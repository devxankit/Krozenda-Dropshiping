import { api } from '../../../lib/axios'

// Live only — there is no fixture, and there must not be: a mocked toggle
// would make this screen look wired up while not actually gating checkout.

export async function fetchPaymentSettings() {
  const { data } = await api.get('/admin/payments/settings')
  return data.data
}

export async function savePaymentSettings(body) {
  const { data } = await api.put('/admin/payments/settings', body)
  return data.data
}
