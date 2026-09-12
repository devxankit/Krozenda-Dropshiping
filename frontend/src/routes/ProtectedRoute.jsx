import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { AUTH_ROUTES } from '../config/routes'

export function ProtectedRoute({ redirectTo = AUTH_ROUTES.LOGIN }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  return <Outlet />
}
