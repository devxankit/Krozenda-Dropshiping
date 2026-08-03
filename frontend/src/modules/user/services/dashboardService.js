// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { userDashboardSummarySchema } from '../schemas/dashboardSchema'

export async function fetchUserDashboardSummary() {
  const { data } = await api.get('/users/me/dashboard-summary')
  return userDashboardSummarySchema.parse(data)
}
