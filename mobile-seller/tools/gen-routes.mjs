// Generates the thin Expo Router files in src/app/(panel)/ that render the seller screens.
// Run: node tools/gen-routes.mjs   (only needed when a screen is added/renamed)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

// route file -> [exported component name, file under modules/vendor-shared/pages]
const ROUTES = {
  status: ['VendorOnboardingStatusPage', 'VendorOnboardingStatusPage'],
  dashboard: ['VendorDashboardPage', 'DashboardPage'],
  products: ['VendorProductsPage', 'ProductsPage'],
  inventory: ['VendorInventoryPage', 'InventoryPage'],
  categories: ['CategoriesPage', 'CategoriesPage'],
  brands: ['BrandsPage', 'BrandsPage'],
  orders: ['OrdersPage', 'OrdersPage'],
  'shipping/index': ['ShippingPage', 'ShipmentsPage'],
  'shipping/settings': ['ShippingSettingsPage', 'ShippingSettingsPage'],
  customers: ['CustomersPage', 'CustomersPage'],
  coupons: ['CouponsPage', 'CouponsPage'],
  returns: ['ReturnsPage', 'ReturnsPage'],
  reviews: ['ReviewsPage', 'ReviewsPage'],
  earnings: ['EarningsPage', 'SettlementsPage'],
  analytics: ['AnalyticsPage', 'AnalyticsPage'],
  revenue: ['RevenuePage', 'RevenuePage'],
  reports: ['ReportsPage', 'ReportsPage'],
  tickets: ['TicketsPage', 'TicketsPage'],
  notifications: ['NotificationsPage', 'NotificationsPage'],
  profile: ['StoreProfilePage', 'StoreProfilePage'],
  'kyc-documents': ['KycDocumentsPage', 'KycDocumentsPage'],
  settings: ['SettingsPage', 'SettingsPage'],
}

for (const [route, [exportName, file]] of Object.entries(ROUTES)) {
  const out = `src/app/(panel)/${route}.js`
  const rel = '../'.repeat(2 + route.split('/').length - 1)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    `import { ${exportName} } from '${rel}modules/vendor-shared/pages/${file}'\n\nexport default function Route() {\n  return <${exportName} />\n}\n`,
  )
}
console.log(Object.keys(ROUTES).length, 'routes')
