import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { HomeScreen } from './components/onboarding'
import { SearchProductsScreen } from './components/ecommerce/SearchProductsScreen'
import { ProductListingScreen } from './components/ecommerce/ProductListingScreen'
import { ProductDetailScreen } from './components/ecommerce/ProductDetailScreen'
import { CartPageScreen } from './components/ecommerce/CartPageScreen'

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

export default function UserRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route
        path="dashboard"
        element={<HomeScreen onNavigateTab={(tab) => tab === 'categories' && navigate('../listing')} />}
      />
      <Route
        path="search"
        element={
          <SearchProductsScreen
            onBack={() => navigate(-1)}
            onSelectSearch={() => navigate('../search/results')}
          />
        }
      />
      <Route
        path="search/results"
        element={
          <SearchFiltersScreen
            onBack={() => navigate('../search')}
            onOpenFilters={() => navigate('../filters')}
            onSelectProduct={() => navigate('../product')}
          />
        }
      />
      <Route
        path="filters"
        element={
          <ProductFiltersScreen
            onBack={() => navigate('../search/results')}
            onApplyFilters={() => navigate('../search/results')}
          />
        }
      />
      <Route
        path="listing"
        element={
          <ProductListingScreen
            onBack={() => navigate('../dashboard')}
            onSelectProduct={() => navigate('../product')}
          />
        }
      />
      <Route
        path="product"
        element={
          <ProductDetailScreen
            onBack={() => navigate('../listing')}
            onAddToCart={() => navigate('../cart')}
            onBuyNow={() => navigate('../cart')}
          />
        }
      />
      <Route
        path="cart"
        element={
          <CartPageScreen
            onBack={() => navigate('../product')}
            onCheckout={() => navigate('../checkout/address')}
          />
        }
      />

      {/* Checkout Flow Routes */}
      <Route
        path="checkout/address"
        element={
          <SelectAddressScreen
            onBack={() => navigate('../cart')}
            onSelectAddress={() => navigate('../delivery')}
          />
        }
      />
      <Route
        path="checkout/delivery"
        element={
          <DeliveryOptionsScreen
            onBack={() => navigate('../address')}
            onChangeAddress={() => navigate('../address')}
            onNext={() => navigate('../summary')}
          />
        }
      />
      <Route
        path="checkout/summary"
        element={
          <OrderSummaryScreen
            onBack={() => navigate('../delivery')}
            onEditCart={() => navigate('../cart')}
            onProceedToPayment={() => navigate('../payment')}
          />
        }
      />
      <Route
        path="checkout/payment"
        element={
          <PaymentScreen
            onBack={() => navigate('../summary')}
            onPaymentSuccess={() => navigate('../success')}
          />
        }
      />
      <Route
        path="checkout/success"
        element={
          <OrderPlacedScreen
            onViewOrderDetails={() => navigate('../../orders/details')}
            onContinueShopping={() => navigate('../../dashboard')}
          />
        }
      />

      {/* Orders & Tracking Routes */}
      <Route
        path="orders"
        element={
          <OrderListScreen
            onSelectOrder={() => navigate('details')}
          />
        }
      />
      <Route
        path="orders/details"
        element={
          <OrderDetailsScreen
            onBack={() => navigate('../orders')}
            onDownloadInvoice={() => navigate('../invoice')}
            onTrackShipment={() => navigate('../track')}
          />
        }
      />
      <Route
        path="orders/track"
        element={
          <TrackShipmentScreen
            onBack={() => navigate('../details')}
            onViewDetails={() => navigate('../details')}
          />
        }
      />
      <Route
        path="orders/invoice"
        element={
          <InvoiceDownloadScreen
            onBack={() => navigate('../details')}
            onDownload={() => navigate('../invoice/preview')}
          />
        }
      />
      <Route
        path="orders/invoice/preview"
        element={
          <InvoicePreviewScreen
            onBack={() => navigate('../invoice')}
            onDownload={() => navigate('../details')}
          />
        }
      />
      <Route
        path="orders/review"
        element={
          <RateReviewScreen
            onBack={() => navigate('../details')}
            onSubmitReview={() => navigate('../orders')}
          />
        }
      />

      {/* Support & Returns Routes */}
      <Route
        path="support"
        element={
          <HelpSupportScreen
            onBack={() => navigate('../profile')}
          />
        }
      />
      <Route
        path="returns"
        element={
          <ReturnReplacementScreen
            onBack={() => navigate('../orders')}
            onContinue={() => navigate('../orders')}
          />
        }
      />

      {/* Profile & Account Routes */}
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
            onBack={() => navigate('../profile')}
            onAddNew={() => navigate('../profile/addresses')}
          />
        }
      />
      <Route
        path="wishlist"
        element={
          <WishlistScreen
            onBack={() => navigate('../dashboard')}
          />
        }
      />
      <Route
        path="coupons"
        element={
          <CouponsOffersScreen
            onBack={() => navigate('../profile')}
          />
        }
      />
      <Route
        path="notifications"
        element={
          <NotificationCenterScreen
            onBack={() => navigate('../dashboard')}
          />
        }
      />
      <Route
        path="settings"
        element={
          <SettingsScreen
            onBack={() => navigate('../profile')}
          />
        }
      />

      <Route path="showcase" element={<UserAppShowcase />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
