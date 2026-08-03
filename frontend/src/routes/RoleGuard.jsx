import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { USER_ROUTES } from '../config/routes'

export function RoleGuard({ permissions = [], mode = 'any', children }) {
  const userPermissions = useAuthStore((state) => state.permissions)

  const isAuthorized =
    permissions.length === 0
      ? true
      : mode === 'any'
        ? permissions.some((permission) => userPermissions.includes(permission))
        : permissions.every((permission) => userPermissions.includes(permission))

  if (!isAuthorized) {
    return <Navigate to={USER_ROUTES.DASHBOARD} replace />
  }

  return children ?? <Outlet />
}
