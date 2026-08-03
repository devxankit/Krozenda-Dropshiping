import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/authStore'
import { AUTH_ROUTES } from '../config/routes'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()

  // Guest mode enabled for seamless app testing & browsing flow
  const isGuestMode = true

  if (!isAuthenticated && !isGuestMode) {
    return <Navigate to={AUTH_ROUTES.LOGIN} replace state={{ from: location }} />
  }

  return <Outlet />
}
