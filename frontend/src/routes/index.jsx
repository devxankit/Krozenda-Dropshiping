import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'
import { Skeleton } from '../components/ui'
import {
  AUTH_ROUTES,
  USER_ROUTES,
  SELLER_ROUTES,
  DROPSHIPPING_PARTNER_ROUTES,
  ADMIN_ROUTES,
} from '../config/routes'
import { SELLER_PERMISSIONS } from '../modules/seller/constants'
import { DROPSHIPPING_PARTNER_PERMISSIONS } from '../modules/dropshipping-partner/constants'
import { ADMIN_PERMISSIONS } from '../modules/admin/constants'
import { useAuthStore } from '../lib/authStore'

const AuthRoutes = lazy(() => import('../modules/auth/routes'))
const UserRoutes = lazy(() => import('../modules/user/routes'))
const SellerRoutes = lazy(() => import('../modules/seller/routes'))
const DropshippingPartnerRoutes = lazy(() => import('../modules/dropshipping-partner/routes'))
const AdminRoutes = lazy(() => import('../modules/admin/routes'))

function RouteFallback() {
  return (
    <div className="p-6">
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function AppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={`${AUTH_ROUTES.ROOT}/*`} element={<AuthRoutes />} />

        <Route element={<ProtectedRoute />}>
          <Route path={`${USER_ROUTES.ROOT}/*`} element={<UserRoutes />} />

          <Route element={<RoleGuard permissions={[SELLER_PERMISSIONS.ACCESS]} />}>
            <Route path={`${SELLER_ROUTES.ROOT}/*`} element={<SellerRoutes />} />
          </Route>

          <Route element={<RoleGuard permissions={[DROPSHIPPING_PARTNER_PERMISSIONS.ACCESS]} />}>
            <Route path={`${DROPSHIPPING_PARTNER_ROUTES.ROOT}/*`} element={<DropshippingPartnerRoutes />} />
          </Route>

          <Route element={<RoleGuard permissions={[ADMIN_PERMISSIONS.ACCESS]} />}>
            <Route path={`${ADMIN_ROUTES.ROOT}/*`} element={<AdminRoutes />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
        <Route path="*" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  )
}
