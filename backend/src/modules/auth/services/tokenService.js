// Layer rule: services/ is the ONLY place that imports a model directly.
import { User, Role } from '../../../models/index.js'
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '../../../lib/jwt.js'
import { ApiError } from '../../../lib/ApiError.js'

// Resolves permissions fresh from Role data on every refresh (rather than
// just re-signing the old claims) so a permission change made in the admin
// panel takes effect on the user's next silent refresh, not only at their
// next full login.
export async function refreshSession(refreshToken) {
  const payload = verifyRefreshToken(refreshToken)

  const user = await User.findById(payload.sub).lean()
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Account is not active.')
  }

  const roles = await Role.find({ key: { $in: user.roles } }).lean()
  const permissions = [...new Set(roles.flatMap((role) => role.permissions))]

  const sessionUser = {
    id: user._id,
    roles: user.roles,
    capabilities: user.capabilities,
    permissions,
  }

  return {
    accessToken: signAccessToken(sessionUser),
    refreshToken: signRefreshToken(sessionUser),
  }
}
