import { Routes, Route, Navigate } from 'react-router-dom'
import { vendorSharedRoutes } from '../vendor-shared/routes'

// Dropshipping-partner shares ~70% of its surface with seller (project
// context §14.4 item 2) — that shared surface lives in vendor-shared/ and is
// mounted here rather than duplicated. Add partner-only routes as additional
// <Route> siblings below vendorSharedRoutes.
export default function DropshippingPartnerRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      {vendorSharedRoutes}
    </Routes>
  )
}
