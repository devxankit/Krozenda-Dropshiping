import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Skeleton } from '../components/ui'
import {
  AUTH_ROUTES,
  USER_ROUTES,
  SELLER_ROUTES,
  DROPSHIPPING_PARTNER_ROUTES,
  ADMIN_ROUTES,
} from '../config/routes'
import { PublicCmsPage } from '../pages/PublicCmsPage'

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
        {/* Dedicated Legal & CMS Policy Pages */}
        <Route path="/p/:slug" element={<PublicCmsPage />} />
        <Route path="/terms" element={<PublicCmsPage defaultSlug="terms" />} />
        <Route path="/terms-and-conditions" element={<PublicCmsPage defaultSlug="terms" />} />
        <Route path="/privacy" element={<PublicCmsPage defaultSlug="privacy-policy" />} />
        <Route path="/privacy-policy" element={<PublicCmsPage defaultSlug="privacy-policy" />} />
        <Route path="/vendor-agreement" element={<PublicCmsPage defaultSlug="vendor-agreement" />} />
        <Route path="/return-policy" element={<PublicCmsPage defaultSlug="return-policy" />} />
        <Route path="/shipping-policy" element={<PublicCmsPage defaultSlug="shipping-policy" />} />
        <Route path="/about" element={<PublicCmsPage defaultSlug="about" />} />
        <Route path="/seller-faq" element={<PublicCmsPage defaultSlug="seller-faq" />} />
        <Route path="/cod-policy" element={<PublicCmsPage defaultSlug="cod-policy" />} />

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

        <Route path={`${USER_ROUTES.ROOT}/*`} element={<UserRoutes />} />

        <Route path="/" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
        <Route path="*" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  )
}
