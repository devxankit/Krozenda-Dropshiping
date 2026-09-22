import { Route } from 'react-router-dom'
import { VendorLayout } from './components/shell/VendorLayout'
import { VendorOnboardingGate } from './components/shell/VendorOnboardingGate'
import { VendorDashboardPage } from './pages/DashboardPage'
import { VendorProductsPage } from './pages/ProductsPage'
import { VendorInventoryPage } from './pages/InventoryPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { BrandsPage } from './pages/BrandsPage'
import { OrdersPage } from './pages/OrdersPage'
import { ShippingPage } from './pages/ShipmentsPage'
import { ShippingSettingsPage } from './pages/ShippingSettingsPage'
import { CustomersPage } from './pages/CustomersPage'
import { CouponsPage } from './pages/CouponsPage'
import { ReturnsPage } from './pages/ReturnsPage'
import { ReviewsPage } from './pages/ReviewsPage'
import { EarningsPage } from './pages/SettlementsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { ReportsPage } from './pages/ReportsPage'
import { TicketsPage } from './pages/TicketsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { StoreProfilePage } from './pages/StoreProfilePage'
import { KycDocumentsPage } from './pages/KycDocumentsPage'
import { SettingsPage } from './pages/SettingsPage'
import { VendorOnboardingStatusPage } from './pages/VendorOnboardingStatusPage'

export const vendorSharedRoutes = (
  <Route element={<VendorLayout />}>
    {/* Inside the layout, so an unapproved seller still gets the shell, the
        sidebar and a way to sign out — but outside it every selling screen is
        redirected to /status. See VendorOnboardingGate. */}
    <Route element={<VendorOnboardingGate />}>
      <Route path="status" element={<VendorOnboardingStatusPage />} />
      <Route path="dashboard" element={<VendorDashboardPage />} />
      <Route path="products" element={<VendorProductsPage />} />
      <Route path="inventory" element={<VendorInventoryPage />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="brands" element={<BrandsPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="shipping" element={<ShippingPage />} />
      <Route path="shipping/settings" element={<ShippingSettingsPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="coupons" element={<CouponsPage />} />
      <Route path="returns" element={<ReturnsPage />} />
      <Route path="reviews" element={<ReviewsPage />} />
      <Route path="earnings" element={<EarningsPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="tickets" element={<TicketsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<StoreProfilePage />} />
      <Route path="kyc-documents" element={<KycDocumentsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
  </Route>
)
