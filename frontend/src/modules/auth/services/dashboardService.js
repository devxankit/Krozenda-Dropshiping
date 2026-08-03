// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { authSessionSchema } from '../schemas/dashboardSchema'

export async function fetchAuthSessionStatus() {
  const { data } = await api.get('/auth/session')
  return authSessionSchema.parse(data)
}
