import { Route } from 'react-router-dom'
import { VendorLayout } from './components/shell/VendorLayout'
import { VendorDashboardPage } from './pages/DashboardPage'
import { VendorProductsPage } from './pages/ProductsPage'
import { VendorInventoryPage } from './pages/InventoryPage'
import { OrdersPage } from './pages/OrdersPage'
import { ShipmentsPage } from './pages/ShipmentsPage'
import { SettlementsPage } from './pages/SettlementsPage'
import { KycDocumentsPage } from './pages/KycDocumentsPage'
import { SettingsPage } from './pages/SettingsPage'

export const vendorSharedRoutes = (
  <Route element={<VendorLayout />}>
    <Route path="dashboard" element={<VendorDashboardPage />} />
    <Route path="products" element={<VendorProductsPage />} />
    <Route path="inventory" element={<VendorInventoryPage />} />
    <Route path="orders" element={<OrdersPage />} />
    <Route path="shipments" element={<ShipmentsPage />} />
    <Route path="settlements" element={<SettlementsPage />} />
    <Route path="kyc-documents" element={<KycDocumentsPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>
)
