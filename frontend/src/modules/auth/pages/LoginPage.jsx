import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  HiArrowLeft,
  HiCheck,
  HiCheckBadge,
  HiShieldCheck,
  HiBolt,
  HiBuildingOffice2,
  HiRocketLaunch,
  HiExclamationCircle,
  HiArrowPath,
  HiLockClosed,
  HiPencilSquare,
  HiXMark,
  HiArrowRight,
  HiShoppingBag,
  HiSparkles,
  HiCheckCircle,
  HiBuildingStorefront,
} from 'react-icons/hi2'
import { USER_ROUTES } from '../../../config/routes'
import { useAuthStore } from '../../../lib/authStore'
import { sendCustomerOtp, verifyCustomerOtp } from '../services/customerAuthService'
import { DesktopLeftShowcase } from '../../../components/common/DesktopLeftShowcase'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // 1: Welcome, 2: Mobile Input, 3: OTP Input, 4: Verified
  const initialStep = location.pathname.includes('welcome') ? 1 : 2
  const [currentStep, setCurrentStep] = useState(initialStep)

  const [phoneNumber, setPhoneNumber] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [isRegistered, setIsRegistered] = useState(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // OTP specific state
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(45)
  const [resendNotice, setResendNotice] = useState('')
  const inputRefs = useRef([])

  const returnUrl = location.state?.from?.pathname || USER_ROUTES.DASHBOARD

  // OTP Countdown timer
  useEffect(() => {
    let interval = null
    if (currentStep === 3 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentStep, timer])

  // Focus first OTP box when entering step 3
  useEffect(() => {
    if (currentStep === 3) {
      setTimeout(() => {
        inputRefs.current[0]?.focus()
      }, 100)
    }
  }, [currentStep])

  // Dashboard/categories/listing/product routes are already reachable
  // without auth (see UserRoutes — only cart/checkout/orders/profile/etc.
  // sit behind ProtectedRoute), so "guest" just means "don't log in" — no
  // session to fake. A fake token used to get set here, which made
  // cartStore/wishlistStore/notificationStore (all gated on isAuthenticated)
  // fire real authenticated API calls that the backend correctly rejected,
  // silently logging the guest back out within moments. `returnUrl` is
  // ignored on purpose: if it points at a protected route (e.g. the guest
  // arrived here via a redirect from /cart), landing there with no real
  // session would just bounce straight back to login.
  const handleGuestAccess = () => {
    navigate(USER_ROUTES.DASHBOARD, { replace: true })
  }

  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhoneNumber(digitsOnly)
    if (error) setError(null)
  }

  const handleClearPhone = () => {
    setPhoneNumber('')
    if (error) setError(null)
  }

  const handleMobileSubmit = async (e) => {
    if (e) e.preventDefault()
    const cleanNumber = phoneNumber.replace(/\D/g, '')
    if (cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number')
      return
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy to continue')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await sendCustomerOtp(cleanNumber)
      setIsRegistered(Boolean(res?.data?.isRegistered))
      setOtp(['', '', '', '', '', ''])
      setTimer(45)
      setCurrentStep(3)
    } catch (err) {
      setError(err?.message || 'Failed to send OTP. Please check the number and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpChange = (index, value) => {
    const cleanChar = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = cleanChar
    setOtp(newOtp)
    if (error) setError(null)

    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto verify if 6th digit entered
    if (cleanChar && index === 5) {
      const fullOtp = [...newOtp.slice(0, 5), cleanChar].join('')
      if (fullOtp.length === 6) {
        verifyOtpCode(fullOtp)
      }
    }
  }

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pastedData) return

    const newOtp = ['', '', '', '', '', '']
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i]
    }
    setOtp(newOtp)

    const nextFocusIdx = Math.min(pastedData.length, 5)
    inputRefs.current[nextFocusIdx]?.focus()

    if (pastedData.length === 6) {
      verifyOtpCode(pastedData)
    }
  }

  const verifyOtpCode = async (enteredOtp) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await verifyCustomerOtp({
        mobileNumber: phoneNumber,
        otp: enteredOtp,
      })

      const customerUser = res?.data?.user
      const accessToken = res?.data?.accessToken

      useAuthStore.getState().setSession({
        user: customerUser,
        roles: ['customer', 'user'],
        permissions: ['customer.access', 'user.access'],
        accessToken,
      })

      setUserProfile(customerUser)
      setIsNewUser(Boolean(res?.isNewUser))
      setCurrentStep(4)
    } catch (err) {
      setError(err?.message || 'Invalid OTP code. Please enter 123456.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!phoneNumber) return
    setTimer(45)
    setError(null)
    try {
      await sendCustomerOtp(phoneNumber)
      setResendNotice('OTP resent successfully!')
      setTimeout(() => setResendNotice(''), 3500)
    } catch (err) {
      setError(err?.message || 'Failed to resend OTP. Please try again.')
    }
  }

  const handleCompleteFlow = () => {
    navigate(returnUrl, { replace: true })
  }

  const formatTimer = (sec) => {
    const s = sec < 10 ? `0${sec}` : sec
    return `00:${s}`
  }

  const isOtpComplete = otp.every((d) => d !== '')

  return (
    <div className="w-full min-h-screen bg-slate-950 md:bg-slate-100 flex flex-col md:flex-row font-sans selection:bg-blue-600 selection:text-white">
      {/* ============================================================ */}
      {/* DESKTOP LEFT SHOWCASE (Visible on tablet & desktop >= md) */}
      {/* ============================================================ */}
      <DesktopLeftShowcase
        title="Direct Factory Wholesale & Automated Dropshipping"
        subtitle="Connect with 500+ verified Indian manufacturers. Enjoy transparent wholesale pricing from unit 1, automated Shiprocket fulfillment, and 7-day safe escrow payouts."
        tag="INDIA'S #1 DROPSHIPPING PLATFORM"
      />

      {/* ============================================================ */}
      {/* RIGHT SIDE: UNIFIED AUTH CONTAINER (Mobile App + Desktop Web) */}
      {/* ============================================================ */}
      <div className="w-full md:w-[480px] lg:w-[540px] xl:w-[580px] shrink-0 min-h-screen bg-slate-50 md:bg-white flex flex-col justify-between shadow-2xl md:border-l md:border-slate-200/80 relative">
        
        {/* ============================================================ */}
        {/* HEADER BAR */}
        {/* Mobile View: Native App Top Bar */}
        {/* Desktop View: Clean Web Top Bar with Guest Link & Support */}
        {/* ============================================================ */}
        <header className="w-full px-4 sm:px-6 py-3.5 sm:py-4 bg-white md:bg-transparent border-b border-slate-200/70 md:border-b-0 flex items-center justify-between z-20 shrink-0">
          {/* Back Action */}
          <div className="flex items-center space-x-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  if (currentStep === 3) setCurrentStep(2)
                  else if (currentStep === 2 && location.state?.from) navigate(USER_ROUTES.DASHBOARD)
                  else if (currentStep === 2) setCurrentStep(1)
                  else setCurrentStep(2)
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all duration-150 active:scale-95 shadow-2xs"
                aria-label="Go back"
              >
                <HiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Mobile App Brand Identity (Hidden on Desktop) */}
            <Link to={USER_ROUTES.DASHBOARD} className="flex md:hidden items-center space-x-2 cursor-pointer transition-opacity hover:opacity-90" title="KroZenda Home">
              <img
                src="/images/logo.png"
                alt="KroZenda"
                className="h-7 w-auto object-contain"
              />
              <div>
                <span className="text-sm font-black text-slate-900 tracking-tight block leading-none">
                  KROZENDA
                </span>
                <span className="text-[9px] font-extrabold text-blue-600 tracking-wider uppercase block mt-0.5">
                  Dropship Hub
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Web Step Indicator (Hidden on Mobile) */}
          <div className="hidden md:flex items-center space-x-3 text-xs font-semibold text-slate-400">
            <span
              className={`flex items-center space-x-1.5 ${
                currentStep === 2
                  ? 'text-blue-600 font-bold'
                  : currentStep > 2
                  ? 'text-emerald-600 font-bold'
                  : ''
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep > 2
                    ? 'bg-emerald-100 text-emerald-700'
                    : currentStep === 2
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {currentStep > 2 ? <HiCheck className="w-3 h-3" /> : '1'}
              </span>
              <span>Mobile</span>
            </span>

            <span className="text-slate-300">━━</span>

            <span
              className={`flex items-center space-x-1.5 ${
                currentStep === 3
                  ? 'text-blue-600 font-bold'
                  : currentStep === 4
                  ? 'text-emerald-600 font-bold'
                  : ''
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === 4
                    ? 'bg-emerald-100 text-emerald-700'
                    : currentStep === 3
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {currentStep === 4 ? <HiCheck className="w-3 h-3" /> : '2'}
              </span>
              <span>Verify</span>
            </span>
          </div>

          {/* Guest Mode Action Button */}
          <button
            type="button"
            onClick={handleGuestAccess}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 text-xs font-bold transition-all active:scale-95 shadow-2xs"
          >
            <span>Guest Mode</span>
            <HiArrowRight className="w-3 h-3 text-blue-600" />
          </button>
        </header>

        {/* ============================================================ */}
        {/* MOBILE HERO APP BANNER (Visible on mobile only < md) */}
        {/* Gives that crisp Meesho / Zepto / Flipkart mobile app feel */}
        {/* ============================================================ */}
        <div className="md:hidden px-4 pt-2 pb-1">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-3.5 text-white shadow-md relative overflow-hidden">
            {/* Background Glow Accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 left-10 w-28 h-28 bg-blue-400/20 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                  <HiBolt className="w-2.5 h-2.5 text-slate-950" />
                  <span>DIRECT FACTORY NETWORK</span>
                </span>
                <h3 className="text-sm font-black text-white pt-1">
                  Wholesale & Dropshipping
                </h3>
                <p className="text-[10px] text-blue-100/90 font-medium">
                  Zero inventory cost • Pan-India express air delivery
                </p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shrink-0">
                <HiRocketLaunch className="w-6 h-6 text-amber-300" />
              </div>
            </div>

            {/* Quick Feature Pills */}
            <div className="relative z-10 grid grid-cols-3 gap-1.5 pt-2.5 mt-2 border-t border-white/15 text-[9.5px] font-bold text-center">
              <div className="bg-white/10 py-1 px-1.5 rounded-lg backdrop-blur-sm">
                🏷️ Factory Rates
              </div>
              <div className="bg-white/10 py-1 px-1.5 rounded-lg backdrop-blur-sm">
                🚚 24-48hr Air
              </div>
              <div className="bg-white/10 py-1 px-1.5 rounded-lg backdrop-blur-sm">
                🛡️ Safe Escrow
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MAIN BODY CONTAINER: CARRIES STEP FORM CARDS */}
        {/* ============================================================ */}
        <div className="flex-1 px-4 sm:px-8 lg:px-12 py-3 sm:py-6 flex flex-col justify-center">
          
          {/* ========================================================== */}
          {/* STEP 1: WELCOME SCREEN (If explicitly navigated) */}
          {/* ========================================================== */}
          {currentStep === 1 && (
            <div className="w-full max-w-sm mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200/80 text-center space-y-6">
              <div className="flex flex-col items-center space-y-2">
                <img
                  src="/images/logo.png"
                  alt="Krozenda Logo"
                  className="h-20 sm:h-24 w-auto object-contain"
                />
                <span className="text-[10px] sm:text-xs font-black tracking-widest text-slate-400 uppercase">
                  B2B • B2C • MARKETPLACE
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 pt-1">
                  Smart Commerce for Every Business
                </h2>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  Connect directly with top manufacturers, enjoy factory margins, and scale pan-India.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
                >
                  <span>Sign In with Mobile</span>
                  <HiArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full bg-slate-50 hover:bg-slate-100 active:scale-[0.98] text-slate-700 font-bold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-2xs transition-all text-xs"
                >
                  Explore as Guest
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-tight">
                By continuing, you agree to our{' '}
                <Link to="/terms" target="_blank" className="text-blue-700 font-bold hover:underline">
                  Terms & Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy-policy" target="_blank" className="text-blue-700 font-bold hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 2: MOBILE NUMBER INPUT SCREEN */}
          {/* ========================================================== */}
          {currentStep === 2 && (
            <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white rounded-3xl p-5 sm:p-7 md:p-8 shadow-md sm:shadow-lg border border-slate-200/80 space-y-4">
              
              {/* Desktop Logo Branding (Hidden on mobile to save vertical space) */}
              <div className="hidden md:flex flex-col items-center text-center space-y-2 pb-2">
                <img
                  src="/images/logo.png"
                  alt="Krozenda Logo"
                  className="h-16 w-auto object-contain"
                />
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-slate-900">
                    Customer Sign In & Register
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter your mobile number. New users are registered automatically!
                  </p>
                </div>
              </div>

              {/* Mobile View Heading */}
              <div className="md:hidden space-y-1">
                <h2 className="text-lg font-black text-slate-900">
                  Enter Mobile Number
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  We'll send an OTP to verify your account
                </p>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div className="w-full flex items-start space-x-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
                  <HiExclamationCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="font-medium leading-snug">{error}</span>
                </div>
              )}

              {/* Mobile Form */}
              <form onSubmit={handleMobileSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Mobile Number
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {phoneNumber.length}/10 digits
                    </span>
                  </div>

                  {/* Clean Input Field with Indian Flag */}
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-2xl p-2.5 sm:p-3 shadow-xs focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white transition-all">
                    <div className="flex items-center space-x-1 text-xs font-bold text-slate-800 border-r border-slate-200 pr-2.5 mr-2.5 shrink-0 select-none">
                      <span>🇮🇳</span>
                      <span>+91</span>
                    </div>

                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder="Enter 10-digit number"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      disabled={isLoading}
                      autoFocus
                      className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-900 focus:outline-none placeholder-slate-400 tracking-wider disabled:opacity-60"
                    />

                    {phoneNumber.length > 0 && !isLoading && (
                      <button
                        type="button"
                        onClick={handleClearPhone}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-full shrink-0"
                      >
                        <HiXMark className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Terms & Conditions Checkbox */}
                <div className="pt-0.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none group">
                    <input
                      type="checkbox"
                      id="accept-terms-privacy"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked)
                        if (error && e.target.checked) setError(null)
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-2 focus:ring-blue-500/20 cursor-pointer accent-blue-700 shrink-0 transition-all"
                    />
                    <span className="text-[11px] sm:text-xs text-slate-600 leading-snug group-hover:text-slate-900 transition-colors">
                      I agree to the{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        className="font-bold text-blue-700 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-700 transition-colors"
                      >
                        Terms & Conditions
                      </Link>{' '}
                      and{' '}
                      <Link
                        to="/privacy-policy"
                        target="_blank"
                        className="font-bold text-blue-700 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-700 transition-colors"
                      >
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || phoneNumber.length !== 10}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold h-12 sm:h-13 rounded-2xl shadow-md transition-all text-xs sm:text-sm tracking-wide flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <HiArrowPath className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue with OTP</span>
                      <HiArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Instant Verification Notice */}
              <div className="py-2 px-3 bg-blue-50/70 rounded-xl border border-blue-100 text-left flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
                <span className="text-[10.5px] sm:text-[11px] text-blue-900 font-medium leading-tight">
                  Instant OTP verification. No complex password required.
                </span>
              </div>

              {/* Trust Features Strip */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-[10.5px] font-semibold text-slate-600">
                <div className="flex flex-col items-center space-y-1">
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <HiShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="leading-tight">100% Secure</span>
                </div>

                <div className="flex flex-col items-center space-y-1">
                  <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                    <HiBolt className="w-4 h-4" />
                  </div>
                  <span className="leading-tight">Auto Sign Up</span>
                </div>

                <div className="flex flex-col items-center space-y-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <HiBuildingStorefront className="w-4 h-4" />
                  </div>
                  <span className="leading-tight">Factory Rates</span>
                </div>
              </div>

              {/* Supplier / Vendor Callout */}
              <div className="pt-2 text-center">
                <Link
                  to="/admin/auth/login"
                  className="text-[11px] text-slate-500 hover:text-blue-700 font-semibold transition-colors"
                >
                  Looking to sell? <span className="text-blue-600 font-bold underline">Supplier / Admin Login →</span>
                </Link>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 3: OTP VERIFICATION SCREEN */}
          {/* ========================================================== */}
          {currentStep === 3 && (
            <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white rounded-3xl p-5 sm:p-7 md:p-8 shadow-md sm:shadow-lg border border-slate-200/80 space-y-4">
              
              {/* Header Info with Phone Badge */}
              <div className="text-center space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Enter OTP Code
                </h2>
                <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500">
                  <span>Sent 6-digit code to</span>
                  <strong className="text-slate-900 font-bold">+91 {phoneNumber}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setCurrentStep(2)
                    }}
                    className="p-1 rounded text-blue-600 hover:text-blue-800 transition-colors"
                    title="Change phone number"
                  >
                    <HiPencilSquare className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Account Status Badge */}
              {isRegistered !== null && (
                <div className="flex justify-center">
                  <div
                    className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      isRegistered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {isRegistered ? (
                      <>
                        <HiShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Existing Member • Direct Login</span>
                      </>
                    ) : (
                      <>
                        <HiSparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>New Customer • Auto-Registration</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Error Alert Box */}
              {error && (
                <div className="w-full flex items-start space-x-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-shake">
                  <HiExclamationCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span className="font-medium leading-snug">{error}</span>
                </div>
              )}

              {/* Resend Notice Box */}
              {resendNotice && (
                <div className="w-full flex items-center space-x-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                  <HiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{resendNotice}</span>
                </div>
              )}

              {/* 6 Digit OTP Inputs (Responsive sizing for both Mobile and Web) */}
              <div className="pt-2">
                <div
                  className="flex justify-center space-x-2 sm:space-x-2.5 mb-5"
                  onPaste={handleOtpPaste}
                >
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      id={`otp-box-${idx}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={isLoading}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`w-10 sm:w-12 h-12 sm:h-14 bg-white border rounded-xl text-center font-black text-xl text-slate-900 focus:outline-none transition-all shadow-xs ${
                        digit
                          ? 'border-blue-600 bg-blue-50/20'
                          : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Verify Button */}
                <button
                  type="button"
                  onClick={() => verifyOtpCode(otp.join(''))}
                  disabled={isLoading || !isOtpComplete}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold h-12 sm:h-13 rounded-2xl shadow-md transition-all text-xs sm:text-sm tracking-wide flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <HiArrowPath className="w-4 h-4 animate-spin" />
                      <span>Verifying OTP...</span>
                    </>
                  ) : (
                    <span>Verify & Login</span>
                  )}
                </button>
              </div>

              {/* Timer & Resend Options */}
              <div className="space-y-2 pt-1 text-center">
                <div className="text-xs font-semibold text-slate-500">
                  {timer > 0 ? (
                    <span>
                      Resend OTP in <strong className="text-blue-600 font-mono">{formatTimer(timer)}</strong>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-blue-600 font-bold hover:underline inline-flex items-center space-x-1"
                    >
                      <HiArrowPath className="w-3.5 h-3.5" />
                      <span>Resend OTP Code</span>
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  Entered wrong number?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setCurrentStep(2)
                    }}
                    className="text-blue-700 font-bold hover:underline"
                  >
                    Change Number
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* STEP 4: VERIFICATION SUCCESS SCREEN */}
          {/* ========================================================== */}
          {currentStep === 4 && (
            <div className="w-full max-w-sm sm:max-w-md mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-md sm:shadow-lg border border-slate-200/80 text-center space-y-6">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
                <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/30">
                  <HiShieldCheck className="w-12 h-12 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
                  <HiSparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isNewUser ? 'New Member Activated' : 'Welcome Back'}</span>
                </div>

                <h2 className="text-2xl font-black text-slate-900">
                  {userProfile?.name ? `Welcome, ${userProfile.name}!` : 'Verification Complete!'}
                </h2>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Verified Mobile: <strong className="text-slate-800 font-semibold">+91 {phoneNumber}</strong>. You now have full access to wholesale prices and orders.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCompleteFlow}
                className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold h-12 sm:h-13 rounded-2xl shadow-md transition-all text-xs sm:text-sm tracking-wide flex items-center justify-center space-x-2"
              >
                <HiShoppingBag className="w-4 h-4" />
                <span>Continue to Marketplace</span>
              </button>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* FOOTER BAR */}
        {/* Mobile View: Clean compact trust footer */}
        {/* Desktop View: Full web copyright & security credentials */}
        {/* ============================================================ */}
        <footer className="w-full px-4 sm:px-6 py-3 border-t border-slate-200/70 bg-white text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-3 text-slate-500 font-medium">
            <span className="flex items-center space-x-1">
              <HiLockClosed className="w-3 h-3 text-emerald-600" />
              <span>256-Bit SSL</span>
            </span>
            <span>• 100% Safe Escrow</span>
            <span className="hidden sm:inline">• GST Invoiced</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400 font-medium">
            <Link to="/terms" target="_blank" className="hover:text-blue-700 transition-colors">
              Terms
            </Link>
            <Link to="/privacy-policy" target="_blank" className="hover:text-blue-700 transition-colors">
              Privacy
            </Link>
            <span className="hidden sm:inline">© 2026 KroZenda</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default LoginPage
