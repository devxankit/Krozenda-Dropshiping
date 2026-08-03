import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'

// Seller shares ~70% of its surface with dropshipping-partner (project
// context §14.4 item 2) — that shared surface lives in vendor-shared/ and is
// mounted here rather than duplicated. Add seller-only routes as additional
// <Route> siblings below vendorSharedRoutes.
export default function SellerRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      {vendorSharedRoutes}
    </Routes>
  )
}
