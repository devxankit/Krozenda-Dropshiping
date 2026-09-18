import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'
import { VendorLoginPage } from '../vendor-shared/pages/VendorLoginPage'
import { RoleGuard } from '../../routes/RoleGuard'
import { DROPSHIPPING_PARTNER_PERMISSIONS } from './constants'
import { TranslationProvider } from '../../lib/i18n'

export default function DropshippingPartnerRoutes() {
  return (
    // Same as the seller panel: these are two front-ends over one Vendor
    // account, and both render the shared vendor screens.
    <TranslationProvider>
      <Routes>
        <Route path="login" element={<VendorLoginPage mode="partner" />} />
        <Route
          element={
            <RoleGuard permissions={[DROPSHIPPING_PARTNER_PERMISSIONS.ACCESS]} redirectTo="/partner/login" />
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          {vendorSharedRoutes}
        </Route>
      </Routes>
    </TranslationProvider>
  )
}
