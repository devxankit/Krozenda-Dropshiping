// Layer rule: services/ is the ONLY place that imports the axios instance.
// One function per endpoint, no React, no react-query — controllers/ call
// these functions, never the other way around.

import { api } from '../../../lib/axios'
import { vendorDashboardSummarySchema } from '../schemas/dashboardSchema'

export async function fetchVendorDashboardSummary() {
  const { data } = await api.get('/vendor/dashboard-summary')
  return vendorDashboardSummarySchema.parse(data)
}
