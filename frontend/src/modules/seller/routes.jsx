import { Routes, Route, Navigate } from 'react'
import { Routes as ReactRoutes, Route as ReactRoute } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'
import { VendorLoginPage } from '../vendor-shared/pages/VendorLoginPage'
import { RoleGuard } from '../../routes/RoleGuard'
import { SELLER_PERMISSIONS } from './constants'

export default function SellerRoutes() {
  return (
    <ReactRoutes>
      <ReactRoute path="login" element={<VendorLoginPage mode="seller" />} />
      <ReactRoute
        element={<RoleGuard permissions={[SELLER_PERMISSIONS.ACCESS]} redirectTo="/seller/login" />}
      >
        <ReactRoute index element={<Navigate to="dashboard" replace />} />
        {vendorSharedRoutes}
      </ReactRoute>
    </ReactRoutes>
  )
}
