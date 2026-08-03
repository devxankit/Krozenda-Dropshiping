// Layer rule: controllers/ handle req/res and call services/ — no model
// imports here, no business logic beyond shaping the HTTP response.
import { asyncHandler } from '../../../lib/asyncHandler.js'
import { ApiResponse } from '../../../lib/ApiResponse.js'
import { getVendorDashboardSummary } from '../services/dashboardService.js'

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await getVendorDashboardSummary(req.user.id)
  new ApiResponse(200, summary).send(res)
})
