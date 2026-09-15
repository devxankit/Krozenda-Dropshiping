import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'
import { VendorLoginPage } from '../vendor-shared/pages/VendorLoginPage'
import { RoleGuard } from '../../routes/RoleGuard'
import { SELLER_PERMISSIONS } from './constants'

export default function SellerRoutes() {
  return (
    <Routes>
      <Route path="login" element={<VendorLoginPage mode="seller" />} />
      <Route element={<RoleGuard permissions={[SELLER_PERMISSIONS.ACCESS]} redirectTo="/seller/login" />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        {vendorSharedRoutes}
      </Route>
    </Routes>
  )
}
