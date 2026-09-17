import React, { useState } from 'react'
import {
  WelcomeScreen,
  MobileInputScreen,
  OtpInputScreen,
  OtpVerifiedScreen,
  HomeScreen,
} from '../components/onboarding'
import { SignupScreen1Mobile } from '../../auth/components/signup/SignupScreen1Mobile'
import { SignupScreen2Otp } from '../../auth/components/signup/SignupScreen2Otp'
import { SignupScreen3Password } from '../../auth/components/signup/SignupScreen3Password'
import { SignupScreen4Email } from '../../auth/components/signup/SignupScreen4Email'
import { SignupScreen5Success } from '../../auth/components/signup/SignupScreen5Success'
import { CatalogBrowseScreen } from '../components/ecommerce/CatalogBrowseScreen'
import { ProductDetailScreen } from '../components/ecommerce/ProductDetailScreen'
import { CartPageScreen } from '../components/ecommerce/CartPageScreen'

import { SelectAddressScreen } from '../components/checkout/SelectAddressScreen'
import { DeliveryOptionsScreen } from '../components/checkout/DeliveryOptionsScreen'
import { OrderSummaryScreen } from '../components/checkout/OrderSummaryScreen'
import { PaymentScreen } from '../components/checkout/PaymentScreen'
import { OrderPlacedScreen } from '../components/checkout/OrderPlacedScreen'

import { OrderListScreen } from '../components/orders/OrderListScreen'
import { OrderDetailsScreen } from '../components/orders/OrderDetailsScreen'
import { TrackShipmentScreen } from '../components/orders/TrackShipmentScreen'
import { InvoiceDownloadScreen } from '../components/orders/InvoiceDownloadScreen'
import { RateReviewScreen } from '../components/orders/RateReviewScreen'

import { ProfileDashboardScreen } from '../components/profile/ProfileDashboardScreen'
import { MyAddressesScreen } from '../components/profile/MyAddressesScreen'
import { WishlistScreen } from '../components/profile/WishlistScreen'
import { CouponsOffersScreen } from '../components/profile/CouponsOffersScreen'
import { NotificationCenterScreen } from '../components/profile/NotificationCenterScreen'

import { HelpSupportScreen } from '../components/support/HelpSupportScreen'
import { ReturnReplacementScreen } from '../components/support/ReturnReplacementScreen'
import { InvoicePreviewScreen } from '../components/orders/InvoicePreviewScreen'

export function UserAppShowcase() {
  const [activeFlow, setActiveFlow] = useState('support') // 'support', 'profile', 'orders', 'checkout', 'ecommerce', 'signup', or 'login'
  const [currentStep, setCurrentStep] = useState(1)
  const [phoneNumber, setPhoneNumber] = useState('98765 43210')
  const [viewMode, setViewMode] = useState('grid') // 'interactive' or 'grid'

  const supportScreens = [
    { id: 1, title: 'Search & Results', stepNum: '31' },
    { id: 2, title: 'Product Filters', stepNum: '32' },
    { id: 3, title: 'Help & Support', stepNum: '33' },
    { id: 4, title: 'Return / Replacement', stepNum: '34' },
    { id: 5, title: 'Invoice Preview', stepNum: '35' },
  ]

  const profileScreens = [
    { id: 1, title: 'Profile Dashboard', stepNum: '26' },
    { id: 2, title: 'My Addresses', stepNum: '27' },
    { id: 3, title: 'Wishlist', stepNum: '28' },
    { id: 4, title: 'Coupons & Offers', stepNum: '29' },
    { id: 5, title: 'Notification Center', stepNum: '30' },
  ]

  const ordersScreens = [
    { id: 1, title: 'Order List', stepNum: '21' },
    { id: 2, title: 'Order Details', stepNum: '22' },
    { id: 3, title: 'Track Shipment', stepNum: '23' },
    { id: 4, title: 'Invoice Download', stepNum: '24' },
    { id: 5, title: 'Rate & Review', stepNum: '25' },
  ]

  const checkoutScreens = [
    { id: 1, title: 'Select Address', stepNum: '16' },
    { id: 2, title: 'Delivery Options', stepNum: '17' },
    { id: 3, title: 'Order Summary', stepNum: '18' },
    { id: 4, title: 'Payment', stepNum: '19' },
    { id: 5, title: 'Order Placed', stepNum: '20' },
  ]

  const ecommerceScreens = [
    { id: 1, title: 'Home Screen', stepNum: '11' },
    { id: 2, title: 'Search Products', stepNum: '12' },
    { id: 3, title: 'Product Listing', stepNum: '13' },
    { id: 4, title: 'Product Detail', stepNum: '14' },
    { id: 5, title: 'Add to Cart', stepNum: '15' },
  ]

  const loginScreens = [
    { id: 1, title: 'Welcome / Login', stepNum: '1' },
    { id: 2, title: 'Enter Mobile Number', stepNum: '2' },
    { id: 3, title: 'Enter OTP', stepNum: '3' },
    { id: 4, title: 'OTP Verified', stepNum: '4' },
    { id: 5, title: 'Login Success / Home', stepNum: '5' },
  ]

  const signupScreens = [
    { id: 1, title: 'Enter Mobile Number', stepNum: '1' },
    { id: 2, title: 'Enter OTP', stepNum: '2' },
    { id: 3, title: 'Set Password', stepNum: '3' },
    { id: 4, title: 'Verify Email (Optional)', stepNum: '4' },
    { id: 5, title: 'Registration Success', stepNum: '5' },
  ]

  const currentScreens =
    activeFlow === 'support'
      ? supportScreens
      : activeFlow === 'profile'
      ? profileScreens
      : activeFlow === 'orders'
      ? ordersScreens
      : activeFlow === 'checkout'
      ? checkoutScreens
      : activeFlow === 'ecommerce'
      ? ecommerceScreens
      : activeFlow === 'signup'
      ? signupScreens
      : loginScreens

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-6 font-sans">
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto mb-6 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 md:p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                User App UI Showcase
              </span>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                KroZenda Marketplace Flow Showcase
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Complete UI replicas for Search & Support (31-35), Profile (26-30), Orders (21-25), Checkout (16-20), Shopping (11-15)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Flow Selector */}
            <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setActiveFlow('support')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'support'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Search & Support (31-35)
              </button>

              <button
                onClick={() => {
                  setActiveFlow('profile')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'profile'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Profile (26-30)
              </button>

              <button
                onClick={() => {
                  setActiveFlow('orders')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'orders'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Orders (21-25)
              </button>

              <button
                onClick={() => {
                  setActiveFlow('checkout')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'checkout'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Checkout (16-20)
              </button>

              <button
                onClick={() => {
                  setActiveFlow('ecommerce')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'ecommerce'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Shopping (11-15)
              </button>

              <button
                onClick={() => {
                  setActiveFlow('signup')
                  setCurrentStep(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFlow === 'signup'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Signup
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All 5 Screens Grid
              </button>
              <button
                onClick={() => setViewMode('interactive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'interactive'
                    ? 'bg-slate-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mobile Viewport
              </button>
            </div>
          </div>
        </div>

        {/* Step Selector Bar for Interactive Mode */}
        {viewMode === 'interactive' && (
          <div className="flex items-center space-x-2 mt-4 overflow-x-auto no-scrollbar pt-2 border-t border-slate-700/50">
            {currentScreens.map((screen) => (
              <button
                key={screen.id}
                onClick={() => setCurrentStep(screen.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  currentStep === screen.id
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30 scale-[1.02]'
                    : 'bg-slate-900/60 text-slate-400 border-slate-700/60 hover:bg-slate-700/40 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                    currentStep === screen.id ? 'bg-white text-blue-600' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {screen.stepNum}
                </span>
                <span>{screen.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === 'grid' ? (
        /* Grid View showing all 5 screens side-by-side */
        <div className="max-w-[1600px] mx-auto overflow-x-auto pb-8">
          <div className="flex items-start space-x-6 min-w-max p-2">
            {currentScreens.map((screen) => (
              <div key={screen.id} className="flex flex-col items-center">
                {/* Step Header */}
                <div className="flex items-center space-x-2 mb-3 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                    {screen.stepNum}
                  </span>
                  <span className="text-xs font-bold text-slate-200">{screen.title}</span>
                </div>

                {/* Mobile Frame */}
                <div className="w-[320px] h-[640px] bg-slate-950 rounded-[40px] p-2.5 shadow-2xl border-2 border-slate-800 relative overflow-hidden hover:scale-[1.01] transition-transform">
                  <div className="w-full h-full rounded-[32px] overflow-hidden bg-white relative">
                    {activeFlow === 'support' ? (
                      <>
                        {screen.id === 1 && <CatalogBrowseScreen mode="search" />}
                        {screen.id === 2 && <CatalogBrowseScreen mode="listing" />}
                        {screen.id === 3 && <HelpSupportScreen />}
                        {screen.id === 4 && <ReturnReplacementScreen />}
                        {screen.id === 5 && <InvoicePreviewScreen />}
                      </>
                    ) : activeFlow === 'profile' ? (
                      <>
                        {screen.id === 1 && <ProfileDashboardScreen />}
                        {screen.id === 2 && <MyAddressesScreen />}
                        {screen.id === 3 && <WishlistScreen />}
                        {screen.id === 4 && <CouponsOffersScreen />}
                        {screen.id === 5 && <NotificationCenterScreen />}
                      </>
                    ) : activeFlow === 'orders' ? (
                      <>
                        {screen.id === 1 && <OrderListScreen />}
                        {screen.id === 2 && <OrderDetailsScreen />}
                        {screen.id === 3 && <TrackShipmentScreen />}
                        {screen.id === 4 && <InvoiceDownloadScreen />}
                        {screen.id === 5 && <RateReviewScreen />}
                      </>
                    ) : activeFlow === 'checkout' ? (
                      <>
                        {screen.id === 1 && <SelectAddressScreen />}
                        {screen.id === 2 && <DeliveryOptionsScreen />}
                        {screen.id === 3 && <OrderSummaryScreen />}
                        {screen.id === 4 && <PaymentScreen />}
                        {screen.id === 5 && <OrderPlacedScreen />}
                      </>
                    ) : activeFlow === 'ecommerce' ? (
                      <>
                        {screen.id === 1 && <HomeScreen />}
                        {screen.id === 2 && <CatalogBrowseScreen mode="search" />}
                        {screen.id === 3 && <CatalogBrowseScreen mode="listing" />}
                        {screen.id === 4 && <ProductDetailScreen />}
                        {screen.id === 5 && <CartPageScreen />}
                      </>
                    ) : activeFlow === 'signup' ? (
                      <>
                        {screen.id === 1 && <SignupScreen1Mobile />}
                        {screen.id === 2 && <SignupScreen2Otp phoneNumber={phoneNumber} />}
                        {screen.id === 3 && <SignupScreen3Password />}
                        {screen.id === 4 && <SignupScreen4Email />}
                        {screen.id === 5 && <SignupScreen5Success />}
                      </>
                    ) : (
                      <>
                        {screen.id === 1 && <WelcomeScreen />}
                        {screen.id === 2 && <MobileInputScreen />}
                        {screen.id === 3 && <OtpInputScreen phoneNumber={phoneNumber} />}
                        {screen.id === 4 && <OtpVerifiedScreen />}
                        {screen.id === 5 && <HomeScreen />}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Interactive Single Mobile Simulator View */
        <div className="max-w-md mx-auto">
          <div className="w-full max-w-[390px] mx-auto h-[780px] bg-slate-950 rounded-[48px] p-3 shadow-2xl ring-1 ring-slate-800 border-4 border-slate-800/80 relative overflow-hidden">
            <div className="w-full h-full rounded-[40px] overflow-hidden bg-white relative">
              {activeFlow === 'support' ? (
                <>
                  {currentStep === 1 && <CatalogBrowseScreen mode="search" />}
                  {currentStep === 2 && <CatalogBrowseScreen mode="listing" />}
                  {currentStep === 3 && <HelpSupportScreen onBack={() => setCurrentStep(1)} />}
                  {currentStep === 4 && <ReturnReplacementScreen onBack={() => setCurrentStep(3)} onContinue={() => setCurrentStep(3)} />}
                  {currentStep === 5 && <InvoicePreviewScreen onBack={() => setCurrentStep(3)} onDownload={() => setCurrentStep(3)} />}
                </>
              ) : activeFlow === 'profile' ? (
                <>
                  {currentStep === 1 && <ProfileDashboardScreen onNavigateMenu={(lbl) => {
                    if (lbl === 'My Addresses') setCurrentStep(2)
                    if (lbl === 'Wishlist') setCurrentStep(3)
                    if (lbl === 'Coupons & Offers') setCurrentStep(4)
                  }} />}
                  {currentStep === 2 && <MyAddressesScreen onBack={() => setCurrentStep(1)} onAddNew={() => setCurrentStep(2)} />}
                  {currentStep === 3 && <WishlistScreen onBack={() => setCurrentStep(1)} />}
                  {currentStep === 4 && <CouponsOffersScreen onBack={() => setCurrentStep(1)} />}
                  {currentStep === 5 && <NotificationCenterScreen onBack={() => setCurrentStep(1)} />}
                </>
              ) : activeFlow === 'orders' ? (
                <>
                  {currentStep === 1 && <OrderListScreen onSelectOrder={() => setCurrentStep(2)} />}
                  {currentStep === 2 && <OrderDetailsScreen onBack={() => setCurrentStep(1)} onDownloadInvoice={() => setCurrentStep(4)} onTrackShipment={() => setCurrentStep(3)} />}
                  {currentStep === 3 && <TrackShipmentScreen onBack={() => setCurrentStep(2)} onViewDetails={() => setCurrentStep(2)} />}
                  {currentStep === 4 && <InvoiceDownloadScreen onBack={() => setCurrentStep(2)} onDownload={() => setCurrentStep(5)} />}
                  {currentStep === 5 && <RateReviewScreen onBack={() => setCurrentStep(2)} onSubmitReview={() => setCurrentStep(1)} />}
                </>
              ) : activeFlow === 'checkout' ? (
                <>
                  {currentStep === 1 && <SelectAddressScreen onNext={() => setCurrentStep(2)} />}
                  {currentStep === 2 && <DeliveryOptionsScreen onBack={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
                  {currentStep === 3 && <OrderSummaryScreen onBack={() => setCurrentStep(2)} onProceedToPayment={() => setCurrentStep(4)} />}
                  {currentStep === 4 && <PaymentScreen onBack={() => setCurrentStep(3)} onPaymentSuccess={() => setCurrentStep(5)} />}
                  {currentStep === 5 && <OrderPlacedScreen />}
                </>
              ) : activeFlow === 'ecommerce' ? (
                <>
                  {currentStep === 1 && <HomeScreen />}
                  {currentStep === 2 && <CatalogBrowseScreen mode="search" />}
                  {currentStep === 3 && <CatalogBrowseScreen mode="listing" />}
                  {currentStep === 4 && <ProductDetailScreen onAddToCart={() => setCurrentStep(5)} onBuyNow={() => setCurrentStep(5)} />}
                  {currentStep === 5 && <CartPageScreen />}
                </>
              ) : activeFlow === 'signup' ? (
                <>
                  {currentStep === 1 && <SignupScreen1Mobile onNext={() => setCurrentStep(2)} />}
                  {currentStep === 2 && <SignupScreen2Otp phoneNumber={phoneNumber} onBack={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
                  {currentStep === 3 && <SignupScreen3Password onBack={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} />}
                  {currentStep === 4 && <SignupScreen4Email onBack={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} onSkip={() => setCurrentStep(5)} />}
                  {currentStep === 5 && <SignupScreen5Success />}
                </>
              ) : (
                <>
                  {currentStep === 1 && <WelcomeScreen onNext={() => setCurrentStep(2)} />}
                  {currentStep === 2 && <MobileInputScreen onBack={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
                  {currentStep === 3 && <OtpInputScreen phoneNumber={phoneNumber} onBack={() => setCurrentStep(2)} onVerifySuccess={() => setCurrentStep(4)} />}
                  {currentStep === 4 && <OtpVerifiedScreen onNext={() => setCurrentStep(5)} />}
                  {currentStep === 5 && <HomeScreen />}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserAppShowcase
