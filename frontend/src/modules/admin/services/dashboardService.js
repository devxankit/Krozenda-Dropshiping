// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { adminDashboardSummarySchema } from '../schemas/dashboardSchema'

export async function fetchAdminDashboardSummary() {
  const { data } = await api.get('/admin/dashboard-summary')
  return adminDashboardSummarySchema.parse(data)
}
