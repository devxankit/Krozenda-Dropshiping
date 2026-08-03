// RBAC gate — the backend equivalent of frontend's RoleGuard. Reads
// `permissions` (plain string[], resolved from Role data at login and
// embedded on the access token — see lib/jwt.js) and checks them against a
// route's required permission keys. Never switches on a role id; permission
// keys are owned by each module (see modules/<name>/constants.js), same
// convention as the frontend.
import { ApiError } from '../lib/ApiError.js'

export function requirePermission(requiredPermissions, { mode = 'all' } = {}) {
  const required = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]

  return function requirePermissionMiddleware(req, _res, next) {
    const userPermissions = req.user?.permissions ?? []

    const isAuthorized =
      required.length === 0
        ? true
        : mode === 'any'
          ? required.some((permission) => userPermissions.includes(permission))
          : required.every((permission) => userPermissions.includes(permission))

    if (!isAuthorized) {
      return next(ApiError.forbidden())
    }

    next()
  }
}
