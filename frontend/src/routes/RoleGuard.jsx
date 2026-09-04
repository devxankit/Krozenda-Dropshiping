import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { USER_ROUTES } from '../config/routes'

// `redirectTo` lets a panel send an unauthorised visitor to its OWN sign-in
// rather than the buyer dashboard — the admin panel has its own login, so
// bouncing an admin to /app/dashboard would be a dead end.
export function RoleGuard({
  permissions = [],
  mode = 'any',
  redirectTo = USER_ROUTES.DASHBOARD,
  children,
}) {
  const userPermissions = useAuthStore((state) => state.permissions)

  const isAuthorized =
    permissions.length === 0
      ? true
      : mode === 'any'
        ? permissions.some((permission) => userPermissions.includes(permission))
        : permissions.every((permission) => userPermissions.includes(permission))

  if (!isAuthorized) {
    return <Navigate to={redirectTo} replace />
  }

  return children ?? <Outlet />
}
