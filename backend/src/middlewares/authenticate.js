// Authenticated-only gate — the backend equivalent of frontend's
// ProtectedRoute. Verifies the access token and sets req.user; does not
// know about permissions (see requirePermission.js, layered after this).
import { verifyAccessToken } from '../lib/jwt.js'
import { ApiError } from '../lib/ApiError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header.')
  }

  const payload = verifyAccessToken(token)

  req.user = {
    id: payload.sub,
    roles: payload.roles ?? [],
    capabilities: payload.capabilities ?? [],
    permissions: payload.permissions ?? [],
    tokenExpiresAt: payload.exp,
  }

  next()
})
