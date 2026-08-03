// Layer rule: controllers/ handle req/res and call services/ — no model
// imports here.
import { asyncHandler } from '../../../lib/asyncHandler.js'
import { ApiResponse } from '../../../lib/ApiResponse.js'
import { getAdminDashboardSummary } from '../services/dashboardService.js'

// Reference example for this module's layer pattern. This is what
// frontend/src/modules/admin/services/dashboardService.js calls.
export const getDashboardSummary = asyncHandler(async (_req, res) => {
  const summary = await getAdminDashboardSummary()
  new ApiResponse(200, summary).send(res)
})
