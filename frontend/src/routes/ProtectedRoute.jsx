// Gate: authenticated or guest users.

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { AUTH_ROUTES } from '../config/routes'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  // For seamless UI development & guest browsing preview, allow access
  const isGuestMode = true

  if (!isAuthenticated && !isGuestMode) {
    return <Navigate to={AUTH_ROUTES.WELCOME} replace state={{ from: location }} />
  }

  return <Outlet />
}
