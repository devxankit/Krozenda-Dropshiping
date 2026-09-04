import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { Skeleton } from '../components/ui'
import {
  AUTH_ROUTES,
  USER_ROUTES,
  SELLER_ROUTES,
  DROPSHIPPING_PARTNER_ROUTES,
  ADMIN_ROUTES,
} from '../config/routes'

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
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path={`${AUTH_ROUTES.ROOT}/*`} element={<AuthRoutes />} />

        {/* The admin, seller, and dropshipping partner panels carry their own
            dedicated login screens (/admin/login, /seller/login, /partner/login).
            Their session & permission guards are applied inside their own router trees. */}
        <Route path={`${ADMIN_ROUTES.ROOT}/*`} element={<AdminRoutes />} />
        <Route path={`${SELLER_ROUTES.ROOT}/*`} element={<SellerRoutes />} />
        <Route
          path={`${DROPSHIPPING_PARTNER_ROUTES.ROOT}/*`}
          element={<DropshippingPartnerRoutes />}
        />

        <Route element={<ProtectedRoute />}>
          <Route path={`${USER_ROUTES.ROOT}/*`} element={<UserRoutes />} />
        </Route>

        <Route path="/" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
        <Route path="*" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  )
}
