// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from './axios'

// audience: 'seller' | 'customer' — published tutorials only.
export async function fetchPublicTutorials(audience) {
  const { data } = await api.get('/tutorials', { params: { audience } })
  return data.data.items
}
