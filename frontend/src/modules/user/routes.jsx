import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { HomeScreen } from './components/onboarding'
import { CatalogBrowseScreen } from './components/ecommerce/CatalogBrowseScreen'
import { ProductDetailScreen } from './components/ecommerce/ProductDetailScreen'
import { CartPageScreen } from './components/ecommerce/CartPageScreen'
import { CategoryListScreen } from './components/ecommerce/CategoryListScreen'

import { AiAssistantLauncher } from './components/ai'
import { USER_ROUTES } from '../../config/routes'
import { ProtectedRoute } from '../../routes/ProtectedRoute'
import { ErrorBoundary } from '../../components/common/ErrorBoundary'
import { NetworkBanner } from '../../components/common/NetworkBanner'
import { ListSkeleton } from '../../components/ui/AsyncBoundary'

// ---------------------------------------------------------------------------
// Code splitting
// ---------------------------------------------------------------------------
// Eager above: the four screens on the shopping path — home, browse, product,
// cart. A shopper hits at least one of them on every visit, so deferring them
// only adds a round trip.
//
// Lazy below: everything a visitor reaches later or not at all. Checkout is
// four screens most sessions never open; the invoice preview alone is one of
// the heaviest components in the app; the showcase imports EVERY screen in the
// buyer app and was previously a static import, so every shopper downloaded
// the whole dev gallery to look at the home page.
const SelectAddressScreen = lazy(() =>
  import('./components/checkout/SelectAddressScreen').then((m) => ({ default: m.SelectAddressScreen })),
)
const PaymentMethodScreen = lazy(() =>
  import('./components/checkout/PaymentMethodScreen').then((m) => ({ default: m.PaymentMethodScreen })),
)
const OrderSummaryScreen = lazy(() =>
  import('./components/checkout/OrderSummaryScreen').then((m) => ({ default: m.OrderSummaryScreen })),
)
const PaymentScreen = lazy(() =>
  import('./components/checkout/PaymentScreen').then((m) => ({ default: m.PaymentScreen })),
)
const OrderPlacedScreen = lazy(() =>
  import('./components/checkout/OrderPlacedScreen').then((m) => ({ default: m.OrderPlacedScreen })),
)

const OrderListScreen = lazy(() =>
  import('./components/orders/OrderListScreen').then((m) => ({ default: m.OrderListScreen })),
)
const OrderDetailsScreen = lazy(() =>
  import('./components/orders/OrderDetailsScreen').then((m) => ({ default: m.OrderDetailsScreen })),
)
const TrackShipmentScreen = lazy(() =>
  import('./components/orders/TrackShipmentScreen').then((m) => ({ default: m.TrackShipmentScreen })),
)
const InvoiceDownloadScreen = lazy(() =>
  import('./components/orders/InvoiceDownloadScreen').then((m) => ({ default: m.InvoiceDownloadScreen })),
)
const InvoicePreviewScreen = lazy(() =>
  import('./components/orders/InvoicePreviewScreen').then((m) => ({ default: m.InvoicePreviewScreen })),
)
const RateReviewScreen = lazy(() =>
  import('./components/orders/RateReviewScreen').then((m) => ({ default: m.RateReviewScreen })),
)

const ProfileDashboardScreen = lazy(() =>
  import('./components/profile/ProfileDashboardScreen').then((m) => ({ default: m.ProfileDashboardScreen })),
)
const EditProfileScreen = lazy(() =>
  import('./components/profile/EditProfileScreen').then((m) => ({ default: m.EditProfileScreen })),
)
const MyAddressesScreen = lazy(() =>
  import('./components/profile/MyAddressesScreen').then((m) => ({ default: m.MyAddressesScreen })),
)
const WishlistScreen = lazy(() =>
  import('./components/profile/WishlistScreen').then((m) => ({ default: m.WishlistScreen })),
)
const CouponsOffersScreen = lazy(() =>
  import('./components/profile/CouponsOffersScreen').then((m) => ({ default: m.CouponsOffersScreen })),
)
const NotificationCenterScreen = lazy(() =>
  import('./components/profile/NotificationCenterScreen').then((m) => ({ default: m.NotificationCenterScreen })),
)
const SettingsScreen = lazy(() =>
  import('./components/profile/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)

const HelpSupportScreen = lazy(() =>
  import('./components/support/HelpSupportScreen').then((m) => ({ default: m.HelpSupportScreen })),
)
const ReturnReplacementScreen = lazy(() =>
  import('./components/support/ReturnReplacementScreen').then((m) => ({ default: m.ReturnReplacementScreen })),
)

const UserAppShowcase = lazy(() =>
  import('./pages/UserAppShowcase').then((m) => ({ default: m.UserAppShowcase })),
)

// A skeleton, not a spinner and not a blank screen: a chunk fetched over a
// slow connection should look like the page arriving, not like nothing
// happening (§34).
function ScreenFallback() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <ListSkeleton count={4} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route shape
// ---------------------------------------------------------------------------
// Every detail route now carries its id IN THE PATH. They used to be flat
// paths that read the id from react-router `location.state`, which meant:
//
//   * a product could not be linked, shared or bookmarked
//   * a push notification could not deep-link to an order (§126)
//   * a WebView reload — which Android does whenever it reclaims memory, and
//     which happens on every return from a UPI app — dropped the state and
//     landed the user on "No product selected" (§110, §111)
//   * the Android back button walked back through screens that then had no
//     data to render
//
// The redirects below keep the OLD flat paths working, so anything already
// linking to them (a previously sent notification, a bookmark) still lands
// somewhere sensible rather than on a 404.
// ---------------------------------------------------------------------------
export default function UserRoutes() {
  return (
    <>
      <NetworkBanner />
      {/* One crashing screen must not blank the whole app — inside a WebView a
          white screen reads as "the app is broken" with no way back. */}
      <ErrorBoundary>
        <Suspense fallback={<ScreenFallback />}>
          <Routes>
            <Route index element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />

            {/* ---- Catalog (public) ---------------------------------------- */}
            <Route path="dashboard" element={<HomeScreen />} />
            <Route path="categories" element={<CategoryListScreen />} />
            <Route path="listing" element={<CatalogBrowseScreen mode="listing" />} />
            <Route path="search" element={<CatalogBrowseScreen mode="search" />} />
            <Route path="product/:productId" element={<ProductDetailScreen />} />

            {/* The filters used to be a whole separate page; they are now a
                sheet on the browse screen itself, so this only redirects. */}
            <Route path="filters" element={<Navigate to={USER_ROUTES.LISTING} replace />} />
            <Route path="search/results" element={<Navigate to={USER_ROUTES.SEARCH} replace />} />
            <Route path="product" element={<Navigate to={USER_ROUTES.LISTING} replace />} />

            <Route path="showcase" element={<UserAppShowcase />} />

            {/* ---- Everything below needs a signed-in buyer ----------------- */}
            <Route element={<ProtectedRoute />}>
              <Route path="cart" element={<CartPageScreen />} />

              <Route path="checkout/address" element={<SelectAddressScreen />} />
              <Route path="checkout/delivery" element={<PaymentMethodScreen />} />
              <Route path="checkout/summary" element={<OrderSummaryScreen />} />
              <Route path="checkout/payment" element={<PaymentScreen />} />
              <Route path="checkout/success" element={<OrderPlacedScreen />} />

              <Route path="orders" element={<OrderListScreen />} />
              <Route path="orders/:orderId" element={<OrderDetailsScreen />} />
              <Route path="orders/:orderId/track" element={<TrackShipmentScreen />} />
              <Route path="orders/:orderId/invoice" element={<InvoiceDownloadScreen />} />
              <Route path="orders/:orderId/invoice/preview" element={<InvoicePreviewScreen />} />
              <Route path="orders/:orderId/review" element={<RateReviewScreen />} />
              {/* Reviewing without naming an order is still reachable — the
                  screen offers a picker of everything delivered. */}
              <Route path="reviews" element={<RateReviewScreen />} />

              {/* Legacy flat paths. `orders/details` etc. carried their id in
                  router state, which no longer exists — send them to the list
                  rather than rendering an empty detail screen. */}
              <Route path="orders/details" element={<Navigate to={USER_ROUTES.ORDERS} replace />} />
              <Route path="orders/track" element={<Navigate to={USER_ROUTES.ORDERS} replace />} />
              <Route path="orders/invoice" element={<Navigate to={USER_ROUTES.ORDERS} replace />} />
              <Route path="orders/review" element={<Navigate to="/app/reviews" replace />} />

              <Route path="support" element={<HelpSupportScreen />} />
              <Route path="returns" element={<ReturnReplacementScreen />} />

              <Route path="profile" element={<ProfileDashboardScreen />} />
              <Route path="profile/addresses" element={<MyAddressesScreen />} />
              <Route path="profile/edit" element={<EditProfileScreen />} />
              <Route path="wishlist" element={<WishlistScreen />} />
              <Route path="coupons" element={<CouponsOffersScreen />} />
              <Route path="notifications" element={<NotificationCenterScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
            </Route>

            {/* Absolute path — a relative "dashboard" here re-resolves against
                the already-unmatched URL on every render of an unmatched deep
                link, appending itself indefinitely instead of landing on the
                dashboard (observed as a "Maximum update depth exceeded" loop). */}
            <Route path="*" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>

      {/* Mounted as a sibling of <Routes> rather than inside a screen, so the
          floating button and any open chat persist across navigation instead of
          unmounting (and losing the in-progress conversation) on every route
          change. It renders nothing for signed-out visitors. */}
      <AiAssistantLauncher />
    </>
  )
}
