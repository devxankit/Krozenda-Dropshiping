// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'

export async function fetchPublicFaqs() {
  const { data } = await api.get('/faq')
  return data.data.items
}
