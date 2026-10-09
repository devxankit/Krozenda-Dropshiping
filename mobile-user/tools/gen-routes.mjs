// Dev-time generator for the thin Expo Router route files in src/app. Each route renders a screen
// component ported from the web app's modules/user (same component names). Re-runnable.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const U = '../modules/user/components' // relative from src/app/<file>
const routes = [
  // [file under src/app, import path from src/modules/user/components, export name, extra props]
  ['dashboard.js', 'onboarding/HomeScreen', 'HomeScreen'],
  ['categories.js', 'ecommerce/CategoryListScreen', 'CategoryListScreen'],
  ['listing.js', 'ecommerce/CatalogBrowseScreen', 'CatalogBrowseScreen', ' mode="listing"'],
  ['search.js', 'ecommerce/CatalogBrowseScreen', 'CatalogBrowseScreen', ' mode="search"'],
  ['product/[productId].js', 'ecommerce/ProductDetailScreen', 'ProductDetailScreen'],
  ['(protected)/cart.js', 'ecommerce/CartPageScreen', 'CartPageScreen'],
  ['(protected)/checkout/address.js', 'checkout/SelectAddressScreen', 'SelectAddressScreen'],
  ['(protected)/checkout/summary.js', 'checkout/OrderSummaryScreen', 'OrderSummaryScreen'],
  ['(protected)/checkout/payment.js', 'checkout/PaymentScreen', 'PaymentScreen'],
  ['(protected)/checkout/success.js', 'checkout/OrderPlacedScreen', 'OrderPlacedScreen'],
  ['(protected)/orders/index.js', 'orders/OrderListScreen', 'OrderListScreen'],
  ['(protected)/orders/[orderId]/index.js', 'orders/OrderDetailsScreen', 'OrderDetailsScreen'],
  ['(protected)/orders/[orderId]/track.js', 'orders/TrackShipmentScreen', 'TrackShipmentScreen'],
  ['(protected)/orders/[orderId]/invoice/index.js', 'orders/InvoiceDownloadScreen', 'InvoiceDownloadScreen'],
  ['(protected)/orders/[orderId]/invoice/preview.js', 'orders/InvoicePreviewScreen', 'InvoicePreviewScreen'],
  ['(protected)/orders/[orderId]/review.js', 'orders/RateReviewScreen', 'RateReviewScreen'],
  ['(protected)/reviews.js', 'orders/RateReviewScreen', 'RateReviewScreen'],
  ['(protected)/support.js', 'support/HelpSupportScreen', 'HelpSupportScreen'],
  ['(protected)/returns.js', 'support/ReturnReplacementScreen', 'ReturnReplacementScreen'],
  ['(protected)/profile/index.js', 'profile/ProfileDashboardScreen', 'ProfileDashboardScreen'],
  ['(protected)/profile/addresses.js', 'profile/MyAddressesScreen', 'MyAddressesScreen'],
  ['(protected)/profile/edit.js', 'profile/EditProfileScreen', 'EditProfileScreen'],
  ['(protected)/wishlist.js', 'profile/WishlistScreen', 'WishlistScreen'],
  ['(protected)/wallet.js', 'profile/WalletScreen', 'WalletScreen'],
  ['(protected)/coupons.js', 'profile/CouponsOffersScreen', 'CouponsOffersScreen'],
  ['(protected)/notifications.js', 'profile/NotificationCenterScreen', 'NotificationCenterScreen'],
  ['(protected)/settings.js', 'profile/SettingsScreen', 'SettingsScreen'],
]

for (const [file, imp, name, props = ''] of routes) {
  const out = join('src/app', file)
  const depth = file.split('/').length - 1
  const rel = '../'.repeat(depth) + '../modules/user/components/' + imp
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `import { ${name} } from '${rel}'\n\nexport default function Route() {\n  return <${name}${props} />\n}\n`)
}
console.log(routes.length, 'route files')
