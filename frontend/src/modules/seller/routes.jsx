import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'
import { VendorLoginPage } from '../vendor-shared/pages/VendorLoginPage'
import { RoleGuard } from '../../routes/RoleGuard'
import { SELLER_PERMISSIONS } from './constants'
import { TranslationProvider } from '../../lib/i18n'

export default function SellerRoutes() {
  return (
    // Wraps the sign-in page too, not just the panel behind the guard — a
    // seller who needs another language needs it before they can sign in.
    // Screens need no changes: the provider translates the rendered DOM.
    <TranslationProvider>
      <Routes>
        <Route path="login" element={<VendorLoginPage mode="seller" />} />
        <Route element={<RoleGuard permissions={[SELLER_PERMISSIONS.ACCESS]} redirectTo="/seller/login" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          {vendorSharedRoutes}
        </Route>
      </Routes>
    </TranslationProvider>
  )
}
