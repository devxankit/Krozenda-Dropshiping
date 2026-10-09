import { Redirect, usePathname } from 'expo-router'
import { useAuthStore } from '../../lib/authStore'
import { AUTH_ROUTES } from '../../config/routes'

// Same rule as app/(protected)/_layout.js, for the tab screens that sit in app/(tabs) instead (the tab
// navigator keeps them mounted, so they cannot live under the protected Stack).
export function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const pathname = usePathname()
  if (!isAuthenticated) {
    return <Redirect href={{ pathname: AUTH_ROUTES.LOGIN, params: { redirect: pathname } }} />
  }
  return children
}
