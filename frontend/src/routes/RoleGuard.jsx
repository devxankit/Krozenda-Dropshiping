// RBAC gate. Reads `permissions` (plain string[] from the API/session) off
// the auth store and checks them against a route's required permission
// keys — it never switches on a role id. Permission keys are owned by each
// module (see modules/<name>/constants.js) so the source of truth for
// "what can Sellers do" lives with the seller module, not here.

import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { ROUTES } from '../config/routes'

export function RoleGuard({ permissions = [], mode = 'all', children }) {
  const userPermissions = useAuthStore((state) => state.permissions)

  const isAuthorized =
    permissions.length === 0
      ? true
      : mode === 'any'
        ? permissions.some((permission) => userPermissions.includes(permission))
        : permissions.every((permission) => userPermissions.includes(permission))

  if (!isAuthorized) {
    return <Navigate to={ROUTES.HOME} replace />
  }

  return children ?? <Outlet />
}
