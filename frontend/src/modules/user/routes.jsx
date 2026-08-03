import React from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Screen5HomeScreen } from './components/onboarding'
import { Screen12SearchProducts } from './components/ecommerce/Screen12SearchProducts'
import { Screen13ProductListing } from './components/ecommerce/Screen13ProductListing'
import { Screen14ProductDetail } from './components/ecommerce/Screen14ProductDetail'
import { Screen15CartPage } from './components/ecommerce/Screen15CartPage'

import { Screen16SelectAddress } from './components/checkout/Screen16SelectAddress'
import { Screen17DeliveryOptions } from './components/checkout/Screen17DeliveryOptions'
import { Screen18OrderSummary } from './components/checkout/Screen18OrderSummary'
import { Screen19Payment } from './components/checkout/Screen19Payment'
import { Screen20OrderPlaced } from './components/checkout/Screen20OrderPlaced'

import { Screen21OrderList } from './components/orders/Screen21OrderList'
import { Screen22OrderDetails } from './components/orders/Screen22OrderDetails'
import { Screen23TrackShipment } from './components/orders/Screen23TrackShipment'
import { Screen24InvoiceDownload } from './components/orders/Screen24InvoiceDownload'
import { Screen25RateReview } from './components/orders/Screen25RateReview'

import { Screen26ProfileDashboard } from './components/profile/Screen26ProfileDashboard'
import { Screen27MyAddresses } from './components/profile/Screen27MyAddresses'
import { Screen28Wishlist } from './components/profile/Screen28Wishlist'
import { Screen29CouponsOffers } from './components/profile/Screen29CouponsOffers'
import { Screen30NotificationCenter } from './components/profile/Screen30NotificationCenter'
import { Screen36Settings } from './components/profile/Screen36Settings'

import { Screen31SearchFilters } from './components/ecommerce/Screen31SearchFilters'
import { Screen32ProductFilters } from './components/ecommerce/Screen32ProductFilters'
import { Screen33HelpSupport } from './components/support/Screen33HelpSupport'
import { Screen34ReturnReplacement } from './components/support/Screen34ReturnReplacement'
import { Screen35InvoicePreview } from './components/orders/Screen35InvoicePreview'

import { UserAppShowcase } from './pages/UserAppShowcase'

export default function UserRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route
        path="dashboard"
        element={<Screen5HomeScreen onNavigateTab={(tab) => tab === 'categories' && navigate('../listing')} />}
      />
      <Route
        path="search"
        element={
          <Screen12SearchProducts
            onBack={() => navigate(-1)}
            onSelectSearch={() => navigate('../search/results')}
          />
        }
      />
      <Route
        path="search/results"
        element={
          <Screen31SearchFilters
            onBack={() => navigate('../search')}
            onOpenFilters={() => navigate('../filters')}
            onSelectProduct={() => navigate('../product')}
          />
        }
      />
      <Route
        path="filters"
        element={
          <Screen32ProductFilters
            onBack={() => navigate('../search/results')}
            onApplyFilters={() => navigate('../search/results')}
          />
        }
      />
      <Route
        path="listing"
        element={
          <Screen13ProductListing
            onBack={() => navigate('../dashboard')}
            onSelectProduct={() => navigate('../product')}
          />
        }
      />
      <Route
        path="product"
        element={
          <Screen14ProductDetail
            onBack={() => navigate('../listing')}
            onAddToCart={() => navigate('../cart')}
            onBuyNow={() => navigate('../cart')}
          />
        }
      />
      <Route
        path="cart"
        element={
          <Screen15CartPage
            onBack={() => navigate('../product')}
            onCheckout={() => navigate('../checkout/address')}
          />
        }
      />

      {/* Checkout Flow Routes */}
      <Route
        path="checkout/address"
        element={
          <Screen16SelectAddress
            onBack={() => navigate('../cart')}
            onSelectAddress={() => navigate('../delivery')}
          />
        }
      />
      <Route
        path="checkout/delivery"
        element={
          <Screen17DeliveryOptions
            onBack={() => navigate('../address')}
            onChangeAddress={() => navigate('../address')}
            onNext={() => navigate('../summary')}
          />
        }
      />
      <Route
        path="checkout/summary"
        element={
          <Screen18OrderSummary
            onBack={() => navigate('../delivery')}
            onEditCart={() => navigate('../cart')}
            onProceedToPayment={() => navigate('../payment')}
          />
        }
      />
      <Route
        path="checkout/payment"
        element={
          <Screen19Payment
            onBack={() => navigate('../summary')}
            onPaymentSuccess={() => navigate('../success')}
          />
        }
      />
      <Route
        path="checkout/success"
        element={
          <Screen20OrderPlaced
            onViewOrderDetails={() => navigate('../../orders/details')}
            onContinueShopping={() => navigate('../../dashboard')}
          />
        }
      />

      {/* Orders & Tracking Routes */}
      <Route
        path="orders"
        element={
          <Screen21OrderList
            onSelectOrder={() => navigate('details')}
          />
        }
      />
      <Route
        path="orders/details"
        element={
          <Screen22OrderDetails
            onBack={() => navigate('../orders')}
            onDownloadInvoice={() => navigate('../invoice')}
            onTrackShipment={() => navigate('../track')}
          />
        }
      />
      <Route
        path="orders/track"
        element={
          <Screen23TrackShipment
            onBack={() => navigate('../details')}
            onViewDetails={() => navigate('../details')}
          />
        }
      />
      <Route
        path="orders/invoice"
        element={
          <Screen24InvoiceDownload
            onBack={() => navigate('../details')}
            onDownload={() => navigate('../invoice/preview')}
          />
        }
      />
      <Route
        path="orders/invoice/preview"
        element={
          <Screen35InvoicePreview
            onBack={() => navigate('../invoice')}
            onDownload={() => navigate('../details')}
          />
        }
      />
      <Route
        path="orders/review"
        element={
          <Screen25RateReview
            onBack={() => navigate('../details')}
            onSubmitReview={() => navigate('../orders')}
          />
        }
      />

      {/* Support & Returns Routes */}
      <Route
        path="support"
        element={
          <Screen33HelpSupport
            onBack={() => navigate('../profile')}
          />
        }
      />
      <Route
        path="returns"
        element={
          <Screen34ReturnReplacement
            onBack={() => navigate('../orders')}
            onContinue={() => navigate('../orders')}
          />
        }
      />

      {/* Profile & Account Routes */}
      <Route
        path="profile"
        element={
          <Screen26ProfileDashboard />
        }
      />
      <Route
        path="profile/addresses"
        element={
          <Screen27MyAddresses
            onBack={() => navigate('../profile')}
            onAddNew={() => navigate('../profile/addresses')}
          />
        }
      />
      <Route
        path="wishlist"
        element={
          <Screen28Wishlist
            onBack={() => navigate('../dashboard')}
          />
        }
      />
      <Route
        path="coupons"
        element={
          <Screen29CouponsOffers
            onBack={() => navigate('../profile')}
          />
        }
      />
      <Route
        path="notifications"
        element={
          <Screen30NotificationCenter
            onBack={() => navigate('../dashboard')}
          />
        }
      />
      <Route
        path="settings"
        element={
          <Screen36Settings
            onBack={() => navigate('../profile')}
          />
        }
      />

      <Route path="showcase" element={<UserAppShowcase />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  )
}
