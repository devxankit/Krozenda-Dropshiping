import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { HomeScreen } from './components/onboarding'
import { SearchProductsScreen } from './components/ecommerce/SearchProductsScreen'
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
import { USER_ROUTES } from '../../config/routes'

export default function UserRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />

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
      <Route
        path="categories"
        element={<CategoryListScreen />}
      />

      {/* Search & Listing */}
      <Route
        path="search"
        element={
          <SearchProductsScreen
            onBack={() => navigate(-1)}
            onSelectSearch={() => navigate(USER_ROUTES.ROOT + '/search/results')}
          />
        }
      />
      <Route
        path="search/results"
        element={
          <SearchFiltersScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/search')}
            onOpenFilters={() => navigate(USER_ROUTES.ROOT + '/filters')}
            onSelectProduct={() => navigate(USER_ROUTES.ROOT + '/product')}
          />
        }
      />
      <Route
        path="filters"
        element={
          <ProductFiltersScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/search/results')}
            onApplyFilters={() => navigate(USER_ROUTES.ROOT + '/search/results')}
          />
        }
      />
      <Route
        path="listing"
        element={
          <ProductListingScreen
            onBack={() => navigate(USER_ROUTES.DASHBOARD)}
            onSelectProduct={() => navigate(USER_ROUTES.ROOT + '/product')}
          />
        }
      />

      {/* Product Details & Cart */}
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
      <Route
        path="cart"
        element={
          <CartPageScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/product')}
            onCheckout={() => navigate(USER_ROUTES.ROOT + '/checkout/address')}
          />
        }
      />

      {/* Seamless Checkout Flow */}
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
            onProceedToPayment={() => navigate(USER_ROUTES.ROOT + '/checkout/payment')}
          />
        }
      />
      <Route
        path="checkout/payment"
        element={
          <PaymentScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/checkout/summary')}
            onPaymentSuccess={() => navigate(USER_ROUTES.ROOT + '/checkout/success')}
          />
        }
      />
      <Route
        path="checkout/success"
        element={
          <OrderPlacedScreen
            onViewOrderDetails={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
            onContinueShopping={() => navigate(USER_ROUTES.DASHBOARD)}
          />
        }
      />

      {/* Orders & Tracking Flow */}
      <Route
        path="orders"
        element={
          <OrderListScreen
            onSelectOrder={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
          />
        }
      />
      <Route
        path="orders/details"
        element={
          <OrderDetailsScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders')}
            onDownloadInvoice={() => navigate(USER_ROUTES.ROOT + '/orders/invoice')}
            onTrackShipment={() => navigate(USER_ROUTES.ROOT + '/orders/track')}
          />
        }
      />
      <Route
        path="orders/track"
        element={
          <TrackShipmentScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
            onViewDetails={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
          />
        }
      />
      <Route
        path="orders/invoice"
        element={
          <InvoiceDownloadScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
            onDownload={() => navigate(USER_ROUTES.ROOT + '/orders/invoice/preview')}
          />
        }
      />
      <Route
        path="orders/invoice/preview"
        element={
          <InvoicePreviewScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders/invoice')}
            onDownload={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
          />
        }
      />
      <Route
        path="orders/review"
        element={
          <RateReviewScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/orders/details')}
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
        element={
          <MyAddressesScreen
            onBack={() => navigate(USER_ROUTES.ROOT + '/profile')}
            onAddNew={() => navigate(USER_ROUTES.ROOT + '/profile/addresses')}
          />
        }
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

      <Route path="showcase" element={<UserAppShowcase />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
