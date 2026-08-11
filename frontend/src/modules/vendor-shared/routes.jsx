import { Route } from 'react-router-dom'
import { VendorDashboardPage } from './pages/DashboardPage'
import { KycDocumentsPage } from './pages/KycDocumentsPage'

// seller/routes.jsx and dropshipping-partner/routes.jsx both spread this
// into their own <Routes> tree — this is the "do not duplicate" surface
// from project context §14.4 item 2. Add more shared vendor routes here as
// the two surfaces need them; keep truly seller-only or partner-only routes
// in that module's own routes.jsx instead.
export const vendorSharedRoutes = (
  <>
    <Route path="dashboard" element={<VendorDashboardPage />} />
    <Route path="kyc-documents" element={<KycDocumentsPage />} />
  </>
)
