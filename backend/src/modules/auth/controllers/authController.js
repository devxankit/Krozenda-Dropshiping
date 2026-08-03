// Layer rule: controllers/ handle req/res and call services/ — no model
// imports here.
import { asyncHandler } from '../../../lib/asyncHandler.js'
import { ApiResponse } from '../../../lib/ApiResponse.js'
import { getSessionStatus } from '../services/sessionService.js'
import { refreshSession } from '../services/tokenService.js'

// Reference example for this module's layer pattern (route -> controller ->
// service). GET /session is what frontend/src/modules/auth/services/
// dashboardService.js calls; POST /refresh-token is what
// frontend/src/lib/axios.js's 401 interceptor calls.
export const getSession = asyncHandler(async (req, res) => {
  const status = getSessionStatus(req.user)
  new ApiResponse(200, status).send(res)
})

export const postRefreshToken = asyncHandler(async (req, res) => {
  const tokens = await refreshSession(req.body.refreshToken)
  new ApiResponse(200, tokens).send(res)
})
