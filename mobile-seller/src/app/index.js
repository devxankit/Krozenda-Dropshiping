import { Redirect } from 'expo-router'
import { useAuthStore } from '../lib/authStore'
import { AUTH_ROUTES, SELLER_ROUTES } from '../config/routes'

// Seller panel entry: signed in -> dashboard, otherwise the seller login (the web's /seller/login).
export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return <Redirect href={isAuthenticated ? SELLER_ROUTES.DASHBOARD : AUTH_ROUTES.LOGIN} />
}
