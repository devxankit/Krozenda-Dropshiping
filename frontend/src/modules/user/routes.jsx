import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { HomeScreen } from './components/onboarding'
import { ProductListingScreen } from './components/ecommerce/ProductListingScreen'
import { ProductDetailScreen } from './components/ecommerce/ProductDetailScreen'
import { CartPageScreen } from './components/ecommerce/CartPageScreen'
import { CategoryListScreen } from './components/ecommerce/CategoryListScreen'

import { SelectAddressScreen } from './components/checkout/SelectAddressScreen'
import { DeliveryOptionsScreen } from './components/checkout/DeliveryOptionsScreen'
import { OrderSummaryScreen } from './components/checkout/OrderSummaryScreen'
import { PaymentScreen } from './components/checkout/PaymentScreen'
import { OrderPlacedScreen } from './components/checkout/OrderPlacedScreen'

import { OrderListScreen } from './components/orders/OrderListScreen'
import { OrderDetailsScreen } from './components/orders/OrderDetailsScreen'
import { TrackShipmentScreen } from './components/orders/TrackShipmentScreen'
import { InvoiceDownloadScreen } from './components/orders/InvoiceDownloadScreen'
import { RateReviewScreen } from './components/orders/RateReviewScreen'

import { ProfileDashboardScreen } from './components/profile/ProfileDashboardScreen'
import { EditProfileScreen } from './components/profile/EditProfileScreen'
import { MyAddressesScreen } from './components/profile/MyAddressesScreen'
import { WishlistScreen } from './components/profile/WishlistScreen'
import { CouponsOffersScreen } from './components/profile/CouponsOffersScreen'
import { NotificationCenterScreen } from './components/profile/NotificationCenterScreen'
import { SettingsScreen } from './components/profile/SettingsScreen'

import { SearchFiltersScreen } from './components/ecommerce/SearchFiltersScreen'
import { ProductFiltersScreen } from './components/ecommerce/ProductFiltersScreen'
import { HelpSupportScreen } from './components/support/HelpSupportScreen'
import { ReturnReplacementScreen } from './components/support/ReturnReplacementScreen'
import { InvoicePreviewScreen } from './components/orders/InvoicePreviewScreen'

import { UserAppShowcase } from './pages/UserAppShowcase'
import { AiAssistantLauncher } from './components/ai'
import { USER_ROUTES } from '../../config/routes'
import { ProtectedRoute } from '../../routes/ProtectedRoute'

export default function UserRoutes() {
  const navigate = useNavigate()

  return (
    <>
    <Routes>
      <Route index element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />

      {/* Main Home & Catalog */}
      <Route
        path="dashboard"
        element={
          <HomeScreen
            onNavigateTab={(tab) => {
              if (tab === 'categories') navigate(USER_ROUTES.ROOT + '/categories')
              if (tab === 'orders') navigate(USER_ROUTES.ROOT + '/orders')
              if (tab === 'wishlist') navigate(USER_ROUTES.ROOT + '/wishlist')
              if (tab === 'profile') navigate(USER_ROUTES.ROOT + '/profile')
            }}
          />
        }
      />

      {/* Step 1 in Flow: Category Selection Page */}
      <Route
        path="categories"
        element={<CategoryListScreen />}
      />

      {/* Step 2 in Flow: Product Listing Page (Category Results) */}
      <Route
        path="listing"
        element={
          <ProductListingScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/categories')}
            onSelectProduct={() => navigate(USER_ROUTES.ROOT + '/product')}
          />
        }
      />

      {/* Direct Search Results (No Separate Intermediate Search Page) */}
      <Route
        path="search"
        element={
          <SearchFiltersScreen
            onBack={() => navigate(USER_ROUTES.DASHBOARD)}
            onOpenFilters={() => navigate(USER_ROUTES.ROOT + '/filters')}
            onSelectProduct={() => navigate(USER_ROUTES.ROOT + '/product')}
          />
        }
      />
      <Route
        path="search/results"
        element={
          <SearchFiltersScreen
            onBack={() => navigate(USER_ROUTES.DASHBOARD)}
            onOpenFilters={() => navigate(USER_ROUTES.ROOT + '/filters')}
            onSelectProduct={() => navigate(USER_ROUTES.ROOT + '/product')}
          />
        }
      />

      {/* Dedicated Filter Options Page */}
      <Route
        path="filters"
        element={
          <ProductFiltersScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/search')}
            onApplyFilters={() => navigate(USER_ROUTES.ROOT + '/search')}
          />
        }
      />

      {/* Step 3 in Flow: Product Details Showcase */}
      <Route
        path="product"
        element={
          <ProductDetailScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/listing')}
            onAddToCart={() => navigate(USER_ROUTES.ROOT + '/cart')}
            onBuyNow={() => navigate(USER_ROUTES.ROOT + '/cart')}
          />
        }
      />

      {/* Component & Flow Showcase (Public for development preview) */}
      <Route path="showcase" element={<UserAppShowcase />} />

      {/* ========================================================================= */}
      {/* PROTECTED CUSTOMER ROUTES (Orders, Profile, Cart, Checkout, Wishlist, etc.) */}
      {/* ========================================================================= */}
      <Route element={<ProtectedRoute />}>
        {/* Step 4 in Flow: Cart Page */}
        <Route
          path="cart"
          element={
            <CartPageScreen
              onBack={() => navigate(USER_ROUTES.ROOT + '/product')}
              onCheckout={() => navigate(USER_ROUTES.ROOT + '/checkout/address')}
            />
          }
        />

      {/* Step 5-8 in Flow: Checkout Steps */}
      <Route
        path="checkout/address"
        element={
          <SelectAddressScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/cart')}
            onSelectAddress={() => navigate(USER_ROUTES.ROOT + '/checkout/delivery')}
          />
        }
      />
      <Route
        path="checkout/delivery"
        element={
          <DeliveryOptionsScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/checkout/address')}
            onChangeAddress={() => navigate(USER_ROUTES.ROOT + '/checkout/address')}
            onNext={() => navigate(USER_ROUTES.ROOT + '/checkout/summary')}
          />
        }
      />
      <Route
        path="checkout/summary"
        element={
          <OrderSummaryScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/checkout/delivery')}
            onEditCart={() => navigate(USER_ROUTES.ROOT + '/cart')}
            onProceedToPayment={({ total }) =>
              navigate(USER_ROUTES.ROOT + '/checkout/payment', { state: { total } })
            }
          />
        }
      />
      <Route
        path="checkout/payment"
        element={
          <PaymentScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/checkout/summary')}
            onPaymentSuccess={(order) =>
              navigate(USER_ROUTES.ROOT + '/checkout/success', { state: { order } })
            }
          />
        }
      />
      <Route
        path="checkout/success"
        element={
          <OrderPlacedScreen
            onViewOrderDetails={(order) => navigate(USER_ROUTES.ROOT + '/orders/details', { state: { orderId: order?.id } })}
            onContinueShopping={() => navigate(USER_ROUTES.DASHBOARD)}
          />
        }
      />

      {/* Orders & Tracking Flow */}
      <Route
        path="orders"
        element={
          <OrderListScreen
            onSelectOrder={(order) => navigate(USER_ROUTES.ROOT + '/orders/details', { state: { orderId: order.id } })}
          />
        }
      />
      <Route
        path="orders/details"
        element={
          <OrderDetailsScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders')}
            onDownloadInvoice={(order) => navigate(USER_ROUTES.ROOT + '/orders/invoice', { state: { orderId: order.id } })}
            onTrackShipment={(order) => navigate(USER_ROUTES.ROOT + '/orders/track', { state: { orderId: order.id } })}
            onRequestReturn={() => navigate(USER_ROUTES.ROOT + '/returns')}
          />
        }
      />
      <Route
        path="orders/track"
        element={
          <TrackShipmentScreen
            onBack={() => navigate(-1)}
            onViewDetails={(order) => navigate(USER_ROUTES.ROOT + '/orders/details', { state: { orderId: order.id } })}
          />
        }
      />
      <Route
        path="orders/invoice"
        element={
          <InvoiceDownloadScreen
            onBack={() => navigate(-1)}
            onDownload={(orderId) => navigate(USER_ROUTES.ROOT + '/orders/invoice/preview', { state: { orderId } })}
          />
        }
      />
      <Route
        path="orders/invoice/preview"
        element={
          <InvoicePreviewScreen
            onBack={() => navigate(-1)}
            onDownload={(orderId) => navigate(USER_ROUTES.ROOT + '/orders/details', { state: { orderId } })}
          />
        }
      />
      <Route
        path="orders/review"
        element={
          <RateReviewScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders')}
            onSubmitReview={() => navigate(USER_ROUTES.ROOT + '/orders')}
          />
        }
      />

      {/* Support & Returns */}
      <Route
        path="support"
        element={
          <HelpSupportScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/profile')}
          />
        }
      />
      <Route
        path="returns"
        element={
          <ReturnReplacementScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders')}
            onContinue={() => navigate(USER_ROUTES.ROOT + '/orders')}
          />
        }
      />

      {/* Profile & Account Settings */}
      <Route
        path="profile"
        element={
          <ProfileDashboardScreen />
        }
      />
      <Route
        path="profile/addresses"
        element={<MyAddressesScreen onBack={() => navigate(USER_ROUTES.ROOT + '/profile')} />}
      />
      <Route
        path="profile/edit"
        element={<EditProfileScreen onBack={() => navigate(USER_ROUTES.ROOT + '/profile')} />}
      />
      <Route
        path="wishlist"
        element={
          <WishlistScreen
            onBack={() => navigate(USER_ROUTES.DASHBOARD)}
          />
        }
      />
      <Route
        path="coupons"
        element={
          <CouponsOffersScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/profile')}
          />
        }
      />
      <Route
        path="notifications"
        element={
          <NotificationCenterScreen
            onBack={() => navigate(USER_ROUTES.DASHBOARD)}
          />
        }
      />
      <Route
        path="settings"
        element={
          <SettingsScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/profile')}
          />
        }
      />
      </Route>

      {/* Absolute path — a relative "dashboard" here re-resolves against the
          already-unmatched URL on every render of an unmatched deep link,
          appending itself indefinitely instead of landing on the dashboard
          (observed as a "Maximum update depth exceeded" infinite loop). */}
      <Route path="*" element={<Navigate to={USER_ROUTES.DASHBOARD} replace />} />
    </Routes>

    {/* Mounted as a sibling of <Routes> rather than inside a screen, so the
        floating button and any open chat persist across navigation instead of
        unmounting (and losing the in-progress conversation) on every route
        change. It renders nothing for signed-out visitors. */}
    <AiAssistantLauncher />
    </>
  )
}
