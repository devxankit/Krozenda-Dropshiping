import { Redirect, Stack, usePathname, useGlobalSearchParams } from 'expo-router'
import { useAuthStore } from '../../lib/authStore'
import { AUTH_ROUTES } from '../../config/routes'
import { colors } from '../../theme'

// Port of routes/ProtectedRoute.jsx: everything inside needs a signed-in buyer. The original path
// travels as ?redirect= (the web passes it as router state `from`).
export default function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  if (!isAuthenticated) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === 'string')).toString()
    const from = qs ? `${pathname}?${qs}` : pathname
    return <Redirect href={{ pathname: AUTH_ROUTES.LOGIN, params: { redirect: from } }} />
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.slate[50] }, animation: 'fade_from_bottom' }} />
}
