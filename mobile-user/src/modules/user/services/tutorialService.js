// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'

export async function fetchPublicTutorials(audience = 'customer') {
  const { data } = await api.get('/tutorials', { params: { audience } })
  return data.data.items
}
