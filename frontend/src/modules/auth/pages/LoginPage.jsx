import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  HiArrowLeft, HiCheck, HiShieldCheck, HiExclamationTriangle,
  HiArrowPath, HiPencilSquare, HiXMark, HiArrowRight,
  HiShoppingBag, HiSparkles, HiCheckCircle, HiLockClosed, HiBolt,
  HiTruck, HiBuildingStorefront, HiStar
} from 'react-icons/hi2'
import { USER_ROUTES } from '../../../config/routes'
import { useAuthStore } from '../../../lib/authStore'
import { sanitizeIndianPhoneNumber } from '../../../lib/phoneUtils'
import { sendCustomerOtp, verifyCustomerOtp } from '../services/customerAuthService'

export function LoginPage() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const initialStep = location.pathname.includes('welcome') ? 1 : 2
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [phoneNumber,   setPhoneNumber]   = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [isRegistered,  setIsRegistered]  = useState(null)
  const [isNewUser,     setIsNewUser]     = useState(false)
  const [userProfile,   setUserProfile]   = useState(null)
  const [isLoading,     setIsLoading]     = useState(false)
  const [error,         setError]         = useState(null)
  const [otp,           setOtp]           = useState(['','','','','',''])
  const [timer,         setTimer]         = useState(45)
  const [resendNotice,  setResendNotice]  = useState('')
  const [stepVisible,   setStepVisible]   = useState(true)
  const inputRefs = useRef([])
  const returnUrl = location.state?.from?.pathname || USER_ROUTES.DASHBOARD

  useEffect(() => {
    let id = null
    if (currentStep === 3 && timer > 0)
      id = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000)
    return () => id && clearInterval(id)
  }, [currentStep, timer])

  useEffect(() => {
    if (currentStep === 3) setTimeout(() => inputRefs.current[0]?.focus(), 350)
  }, [currentStep])

  const changeStep = (next) => {
    setStepVisible(false)
    setTimeout(() => { setCurrentStep(next); setStepVisible(true) }, 260)
  }

  const goBack = () => {
    setError(null)
    if      (currentStep === 3)                         changeStep(2)
    else if (currentStep === 2 && location.state?.from) navigate(USER_ROUTES.DASHBOARD)
    else if (currentStep === 2 && initialStep === 1)    changeStep(1)
    else if (currentStep === 4)                         changeStep(2)
    else                                                navigate(USER_ROUTES.DASHBOARD)
  }

  const handlePhoneChange = e => {
    const val = sanitizeIndianPhoneNumber(e.target.value)
    setPhoneNumber(val)
    if (error) setError(null)
  }

  const handlePhonePaste = e => {
    e.preventDefault()
    const pasted = e.clipboardData?.getData('text') || ''
    const val = sanitizeIndianPhoneNumber(pasted)
    setPhoneNumber(val)
    if (error) setError(null)
  }

  const handleMobileSubmit = async e => {
    if (e) e.preventDefault()
    const clean = phoneNumber.replace(/\D/g,'')
    if (clean.length !== 10) return setError('Please enter a valid 10-digit mobile number.')
    if (!acceptedTerms)      return setError('Please accept Terms & Conditions to continue.')
    setIsLoading(true); setError(null)
    try {
      const res = await sendCustomerOtp(clean)
      setIsRegistered(Boolean(res?.data?.isRegistered))
      setOtp(['','','','','','']); setTimer(45)
      changeStep(3)
    } catch (err) { setError(err?.message || 'Could not send OTP. Please try again.') }
    finally { setIsLoading(false) }
  }

  const handleOtpChange = (i, val) => {
    const ch = val.replace(/\D/g,'').slice(-1)
    const next = [...otp]; next[i] = ch; setOtp(next)
    if (error) setError(null)
    if (ch && i < 5) inputRefs.current[i+1]?.focus()
    if (ch && i === 5) {
      const full = [...next.slice(0,5), ch].join('')
      if (full.length === 6) verifyOtpCode(full)
    }
  }

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i-1]?.focus()
  }

  const handleOtpPaste = e => {
    e.preventDefault()
    const data = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (!data) return
    const n = ['','','','','','']
    for (let i = 0; i < data.length; i++) n[i] = data[i]
    setOtp(n)
    inputRefs.current[Math.min(data.length,5)]?.focus()
    if (data.length === 6) verifyOtpCode(data)
  }

  const verifyOtpCode = async entered => {
    setIsLoading(true); setError(null)
    try {
      const res = await verifyCustomerOtp({ mobileNumber: phoneNumber, otp: entered })
      useAuthStore.getState().setSession({
        user: res?.data?.user,
        roles: ['customer','user'],
        permissions: ['customer.access','user.access'],
        accessToken: res?.data?.accessToken,
      })
      setUserProfile(res?.data?.user)
      setIsNewUser(Boolean(res?.isNewUser))
      changeStep(4)
    } catch (err) { setError(err?.message || 'Invalid OTP. Please try again.') }
    finally { setIsLoading(false) }
  }

  const handleResendOtp = async () => {
    if (!phoneNumber) return
    setTimer(45); setError(null)
    try {
      await sendCustomerOtp(phoneNumber)
      setResendNotice('OTP resent successfully!')
      setTimeout(() => setResendNotice(''), 3000)
    } catch (err) { setError(err?.message || 'Failed to resend OTP.') }
  }

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const isOtpComplete = otp.every(d => d !== '')
  const isPhoneValid = phoneNumber.length === 10

  return (
    <div className="lp-root">
      {/* ═══════════ DYNAMIC AMBIENT BACKGROUND ═══════════ */}
      <div className="lp-ambient-bg" aria-hidden>
        <div className="lp-orb lp-orb-primary" />
        <div className="lp-orb lp-orb-cyan" />
        <div className="lp-orb lp-orb-violet" />
        <div className="lp-dot-pattern" />
      </div>

      {/* ═══════════ MODERN FROSTED HEADER ═══════════ */}
      <header className="lp-header">
        <div className="lp-header-content">
          {currentStep > 1 ? (
            <button className="lp-nav-icon-btn" onClick={goBack} aria-label="Go back">
              <HiArrowLeft className="lp-arrow-icon" />
            </button>
          ) : (
            <div className="lp-nav-placeholder" />
          )}

          <Link to={USER_ROUTES.DASHBOARD} className="lp-brand-container">
            <div className="lp-logo-glow">
              <img src="/images/logo.png" alt="KroZenda" className="lp-logo-img" />
            </div>
            <div className="lp-brand-text-col">
              <span className="lp-brand-title">KroZenda</span>
              <span className="lp-brand-subtitle">Dropshipping Hub</span>
            </div>
          </Link>

          <button
            className="lp-guest-btn"
            onClick={() => navigate(USER_ROUTES.DASHBOARD, { replace: true })}
          >
            <span>Guest</span>
            <HiArrowRight className="lp-guest-arrow" />
          </button>
        </div>
      </header>

      {/* ═══════════ MAIN VIEWPORT CONTAINER ═══════════ */}
      <main className="lp-main">
        <div className="lp-card-wrapper">
          <div className="lp-card">
            {/* High-end animated color wave strip */}
            <div className="lp-card-glow-strip" />

            <div className={`lp-card-body ${stepVisible ? 'lp-visible' : 'lp-hidden'}`}>

              {/* ════════════ STEP 1: WELCOME SCREEN ════════════ */}
              {currentStep === 1 && (
                <div className="lp-step-container lp-step-welcome">
                  <div className="lp-welcome-hero-avatar">
                    <div className="lp-hero-pulse-ring-outer" />
                    <div className="lp-hero-pulse-ring-inner" />
                    <div className="lp-hero-logo-box">
                      <img src="/images/logo.png" alt="KroZenda" className="lp-welcome-logo-img" />
                    </div>
                  </div>

                  <div className="lp-verified-badge">
                    <HiSparkles className="lp-sparkle-icon" />
                    <span>India's #1 B2B & B2C Dropshipping Platform</span>
                  </div>

                  <h1 className="lp-hero-title">
                    Direct Factory Wholesale &amp; Commerce
                  </h1>

                  <p className="lp-hero-desc">
                    Connect directly with top manufacturers. Single unit wholesale pricing, zero inventory holding, pan-India 24-48hr dispatch.
                  </p>

                  <div className="lp-action-stack">
                    <button className="lp-primary-btn lp-btn-shine" onClick={() => changeStep(2)}>
                      <span>Sign In with Mobile</span>
                      <HiArrowRight className="lp-btn-icon-slide" />
                    </button>

                    <button
                      className="lp-secondary-btn"
                      onClick={() => navigate(USER_ROUTES.DASHBOARD, { replace: true })}
                    >
                      Explore Wholesale Marketplace
                    </button>
                  </div>

                  <p className="lp-terms-notice">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" target="_blank">Terms of Service</Link> &amp;{' '}
                    <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>
                  </p>
                </div>
              )}

              {/* ════════════ STEP 2: MOBILE INPUT SCREEN ════════════ */}
              {currentStep === 2 && (
                <div className="lp-step-container">
                  {/* Stepper Progress */}
                  <div className="lp-stepper-bar">
                    <div className="lp-stepper-item lp-stepper-active">
                      <div className="lp-step-circle">1</div>
                      <span className="lp-step-label">Mobile</span>
                    </div>
                    <div className="lp-stepper-connector">
                      <div
                        className="lp-connector-fill"
                        style={{ width: isPhoneValid ? '50%' : '0%' }}
                      />
                    </div>
                    <div className="lp-stepper-item lp-stepper-idle">
                      <div className="lp-step-circle">2</div>
                      <span className="lp-step-label">Verify</span>
                    </div>
                  </div>

                  {/* Brand Icon & Live Status */}
                  <div className="lp-avatar-center">
                    <div className="lp-avatar-glow-ring" />
                    <div className="lp-avatar-box">
                      <img src="/images/logo.png" alt="KroZenda" className="lp-avatar-img" />
                    </div>
                    <div className="lp-live-pill">
                      <span className="lp-live-dot" />
                      <span>Live Wholesale Access</span>
                    </div>
                  </div>

                  {/* Screen Title */}
                  <div className="lp-title-group">
                    <h1 className="lp-main-title">Enter Your Mobile</h1>
                    <p className="lp-subtitle">
                      Enter your 10-digit number. We'll send a 6-digit OTP — no passwords required.
                    </p>
                  </div>

                  {error && <ErrorAlert msg={error} />}

                  {/* Mobile Input Form */}
                  <form onSubmit={handleMobileSubmit} className="lp-phone-form">
                    <div className={`lp-input-container ${error ? 'lp-input-error' : ''} ${isPhoneValid ? 'lp-input-valid' : ''}`}>
                      <div className="lp-country-badge">
                        <IndianFlag />
                        <span className="lp-country-code">+91</span>
                      </div>

                      <div className="lp-input-separator" />

                      <input
                        id="mobile-input"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={16}
                        placeholder="Enter 10-digit number"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        onPaste={handlePhonePaste}
                        disabled={isLoading}
                        autoFocus
                        className="lp-text-input"
                      />

                      {phoneNumber && !isLoading && (
                        <button
                          type="button"
                          className="lp-input-clear-btn"
                          onClick={() => { setPhoneNumber(''); setError(null) }}
                          aria-label="Clear mobile number"
                        >
                          <HiXMark />
                        </button>
                      )}
                    </div>

                    {/* Interactive Digit Progress Indicator */}
                    <div className="lp-digit-indicator-wrap">
                      <div className="lp-digit-dots-row">
                        {Array.from({ length: 10 }).map((_, index) => {
                          const isFilled = index < phoneNumber.length
                          return (
                            <span
                              key={index}
                              className={`lp-digit-dot ${isFilled ? 'lp-digit-filled' : ''}`}
                            />
                          )
                        })}
                      </div>
                      <span className={`lp-digit-counter ${isPhoneValid ? 'lp-counter-done' : ''}`}>
                        {isPhoneValid ? '✓ 10 Digits Complete' : `${phoneNumber.length}/10 digits`}
                      </span>
                    </div>

                    {/* Terms Checkbox */}
                    <label className="lp-checkbox-label">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={e => {
                          setAcceptedTerms(e.target.checked)
                          if (error && e.target.checked) setError(null)
                        }}
                        className="lp-native-checkbox"
                      />
                      <span className="lp-checkbox-custom">
                        {acceptedTerms && <HiCheck className="lp-check-svg" />}
                      </span>
                      <span className="lp-checkbox-caption">
                        I agree to KroZenda's{' '}
                        <Link to="/terms" target="_blank">Terms of Service</Link> &amp;{' '}
                        <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>
                      </span>
                    </label>

                    {/* Submit CTA Button */}
                    <button
                      type="submit"
                      disabled={isLoading || !isPhoneValid}
                      className={`lp-primary-btn lp-btn-shine ${!isPhoneValid || isLoading ? 'lp-btn-disabled' : 'lp-btn-active-glow'}`}
                    >
                      {isLoading ? (
                        <>
                          <HiArrowPath className="lp-spin-icon" />
                          <span>Sending Secure OTP…</span>
                        </>
                      ) : (
                        <>
                          <span>{isPhoneValid ? 'Get Verification Code' : 'Enter Mobile to Continue'}</span>
                          <HiArrowRight className="lp-btn-icon-slide" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Trust & Benefits Horizontal Strip */}
                  <div className="lp-benefits-container">
                    <div className="lp-benefit-item">
                      <div className="lp-benefit-icon-box lp-icon-blue">
                        <HiBuildingStorefront />
                      </div>
                      <div className="lp-benefit-text">
                        <span className="lp-benefit-title">Factory Direct</span>
                        <span className="lp-benefit-sub">Up to 70% Wholesale</span>
                      </div>
                    </div>

                    <div className="lp-benefit-item">
                      <div className="lp-benefit-icon-box lp-icon-amber">
                        <HiBolt />
                      </div>
                      <div className="lp-benefit-text">
                        <span className="lp-benefit-title">Instant Access</span>
                        <span className="lp-benefit-sub">Zero Password Friction</span>
                      </div>
                    </div>

                    <div className="lp-benefit-item">
                      <div className="lp-benefit-icon-box lp-icon-emerald">
                        <HiShieldCheck />
                      </div>
                      <div className="lp-benefit-text">
                        <span className="lp-benefit-title">Escrow Safe</span>
                        <span className="lp-benefit-sub">100% Protected Orders</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════════ STEP 3: OTP VERIFICATION SCREEN ════════════ */}
              {currentStep === 3 && (
                <div className="lp-step-container">
                  {/* Stepper Progress */}
                  <div className="lp-stepper-bar">
                    <div className="lp-stepper-item lp-stepper-done">
                      <div className="lp-step-circle"><HiCheck /></div>
                      <span className="lp-step-label">Mobile</span>
                    </div>
                    <div className="lp-stepper-connector">
                      <div className="lp-connector-fill lp-connector-full" />
                    </div>
                    <div className="lp-stepper-item lp-stepper-active">
                      <div className="lp-step-circle">2</div>
                      <span className="lp-step-label">Verify</span>
                    </div>
                  </div>

                  {/* Active Phone Badge with Edit Action */}
                  <div className="lp-verified-phone-pill">
                    <div className="lp-pill-prefix">
                      <IndianFlag />
                      <span className="lp-pill-number">+91 {phoneNumber}</span>
                    </div>
                    <button
                      className="lp-change-phone-btn"
                      onClick={() => { setError(null); changeStep(2) }}
                      title="Change phone number"
                    >
                      <HiPencilSquare className="lp-pencil-icon" />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Screen Title */}
                  <div className="lp-title-group">
                    <h1 className="lp-main-title">Enter Verification Code</h1>
                    <p className="lp-subtitle">
                      We sent a 6-digit one-time password to your mobile number.
                    </p>
                  </div>

                  {/* Account Status Badge */}
                  {isRegistered !== null && (
                    <div className={`lp-member-status-chip ${isRegistered ? 'lp-chip-member' : 'lp-chip-new'}`}>
                      {isRegistered ? (
                        <>
                          <HiShieldCheck className="lp-chip-icon" />
                          <span>Existing Member • Welcome back</span>
                        </>
                      ) : (
                        <>
                          <HiSparkles className="lp-chip-icon" />
                          <span>New Account • Free Wholesale Access Activated</span>
                        </>
                      )}
                    </div>
                  )}

                  {error && <ErrorAlert msg={error} />}

                  {resendNotice && (
                    <div className="lp-success-alert">
                      <HiCheckCircle className="lp-alert-icon" />
                      <span>{resendNotice}</span>
                    </div>
                  )}

                  {/* 6-Digit OTP Boxes */}
                  <div className="lp-otp-wrapper" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => (inputRefs.current[i] = el)}
                        id={`otp-box-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        disabled={isLoading}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        aria-label={`OTP digit ${i+1}`}
                        className={`lp-otp-input-cell ${digit ? 'lp-otp-cell-filled' : ''} ${isLoading ? 'lp-otp-cell-loading' : ''}`}
                      />
                    ))}
                  </div>

                  {/* Verify & Login Button */}
                  <button
                    className={`lp-primary-btn lp-btn-shine ${!isOtpComplete || isLoading ? 'lp-btn-disabled' : 'lp-btn-active-glow'}`}
                    disabled={isLoading || !isOtpComplete}
                    onClick={() => verifyOtpCode(otp.join(''))}
                  >
                    {isLoading ? (
                      <>
                        <HiArrowPath className="lp-spin-icon" />
                        <span>Verifying Credentials…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify &amp; Continue</span>
                        <HiArrowRight className="lp-btn-icon-slide" />
                      </>
                    )}
                  </button>

                  {/* Resend & Edit Navigation */}
                  <div className="lp-resend-row">
                    {timer > 0 ? (
                      <div className="lp-timer-badge">
                        <span className="lp-timer-text">Resend code in</span>
                        <span className="lp-timer-clock">{fmt(timer)}</span>
                      </div>
                    ) : (
                      <button className="lp-link-btn lp-resend-active" onClick={handleResendOtp}>
                        <HiArrowPath className="lp-inline-icon" />
                        <span>Resend OTP</span>
                      </button>
                    )}

                    <span className="lp-link-sep">•</span>

                    <button
                      className="lp-link-btn"
                      onClick={() => { setError(null); changeStep(2) }}
                    >
                      Change Number
                    </button>
                  </div>
                </div>
              )}

              {/* ════════════ STEP 4: SUCCESS CONFIRMATION ════════════ */}
              {currentStep === 4 && (
                <div className="lp-step-container lp-step-success">
                  <div className="lp-success-visual">
                    <div className="lp-success-halo lp-halo-outer" />
                    <div className="lp-success-halo lp-halo-inner" />
                    <div className="lp-success-badge-icon">
                      <HiShieldCheck />
                    </div>
                  </div>

                  <div className="lp-verified-pill-success">
                    <HiSparkles className="lp-sparkle-icon" />
                    <span>{isNewUser ? 'Welcome to KroZenda!' : 'Welcome Back!'}</span>
                  </div>

                  <h1 className="lp-main-title">
                    {userProfile?.name ? `Hello, ${userProfile.name}!` : 'Verification Complete!'}
                  </h1>

                  <p className="lp-subtitle">
                    Successfully verified for <strong style={{ color: '#0f172a' }}>+91 {phoneNumber}</strong>.
                    <br />You have unlocked full factory wholesale pricing and order management.
                  </p>

                  <button
                    className="lp-success-cta-btn lp-btn-shine"
                    onClick={() => navigate(returnUrl, { replace: true })}
                  >
                    <HiShoppingBag className="lp-shopping-icon" />
                    <span>Continue to Marketplace</span>
                    <HiArrowRight className="lp-btn-icon-slide" />
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Clean Security Footer */}
          <footer className="lp-page-footer">
            <div className="lp-footer-trust">
              <HiLockClosed className="lp-ssl-icon" />
              <span>256-Bit SSL Encrypted • RBI Compliant Escrow • GST Invoiced</span>
            </div>
            <div className="lp-footer-links">
              <Link to="/terms" target="_blank" className="lp-footer-link">Terms</Link>
              <span className="lp-footer-dot">•</span>
              <Link to="/privacy-policy" target="_blank" className="lp-footer-link">Privacy Policy</Link>
              <span className="lp-footer-dot">•</span>
              <Link to="/help" target="_blank" className="lp-footer-link">Help &amp; Support</Link>
            </div>
          </footer>
        </div>
      </main>

      {/* ═══════════ SCOPED MODERN LIGHT DESIGN SYSTEM ═══════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

        /* RESET & BASE */
        .lp-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          color: #0f172a;
          position: relative;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* AMBIENT BACKGROUND GLOW & DOT GRID */
        .lp-ambient-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.65;
          animation: lpOrbFloat 20s ease-in-out infinite alternate;
        }
        .lp-orb-primary {
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(79, 70, 229, 0.05) 70%, transparent 100%);
          top: -160px;
          left: -120px;
        }
        .lp-orb-cyan {
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.20) 0%, rgba(6, 182, 212, 0.04) 70%, transparent 100%);
          bottom: -100px;
          right: -100px;
          animation-delay: -7s;
        }
        .lp-orb-violet {
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(217, 70, 239, 0.14) 0%, rgba(168, 85, 247, 0.03) 70%, transparent 100%);
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
        }
        .lp-dot-pattern {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.7;
        }
        @keyframes lpOrbFloat {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.06); }
          100% { transform: translateY(20px) scale(0.96); }
        }

        /* HEADER */
        .lp-header {
          position: relative;
          z-index: 30;
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
        }
        .lp-header-content {
          max-width: 500px;
          margin: 0 auto;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-nav-icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .lp-nav-icon-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #cbd5e1;
          transform: translateX(-2px);
        }
        .lp-arrow-icon {
          width: 18px;
          height: 18px;
        }
        .lp-nav-placeholder {
          width: 38px;
        }
        .lp-brand-container {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .lp-logo-glow {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .lp-logo-img {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }
        .lp-brand-text-col {
          display: flex;
          flex-direction: column;
        }
        .lp-brand-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
          line-height: 1.15;
        }
        .lp-brand-subtitle {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6366f1;
        }
        .lp-guest-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .lp-guest-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .lp-guest-arrow {
          width: 12px;
          height: 12px;
          transition: transform 0.2s;
        }
        .lp-guest-btn:hover .lp-guest-arrow {
          transform: translateX(3px);
        }

        /* MAIN WRAPPER */
        .lp-main {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 16px 32px;
        }
        .lp-card-wrapper {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* MODERN CARD */
        .lp-card {
          background: #ffffff;
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.85);
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04),
            0 12px 36px -4px rgba(99, 102, 241, 0.08),
            0 24px 64px -12px rgba(15, 23, 42, 0.06);
          overflow: hidden;
          position: relative;
          animation: lpCardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lpCardEntrance {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* HIGH-END ANIMATED COLOR STRIP */
        .lp-card-glow-strip {
          height: 3.5px;
          background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 30%, #10b981 60%, #8b5cf6 85%, #4f46e5 100%);
          background-size: 200% 100%;
          animation: lpGlowStripWave 4s linear infinite;
        }
        @keyframes lpGlowStripWave {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }

        /* STEP BODY ANIMATION */
        .lp-card-body {
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .lp-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .lp-hidden {
          opacity: 0;
          transform: translateY(8px);
        }

        /* STEP CONTAINER */
        .lp-step-container {
          padding: 28px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 440px) {
          .lp-step-container {
            padding: 34px 32px 36px;
          }
        }

        /* STEP PROGRESS BAR */
        .lp-stepper-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 220px;
          margin: 0 auto;
        }
        .lp-stepper-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .lp-step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-step-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .lp-stepper-active .lp-step-circle {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35);
        }
        .lp-stepper-active .lp-step-label {
          color: #4f46e5;
        }
        .lp-stepper-done .lp-step-circle {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }
        .lp-stepper-done .lp-step-label {
          color: #059669;
        }
        .lp-stepper-idle .lp-step-circle {
          background: #f1f5f9;
          color: #94a3b8;
          border: 1px solid #e2e8f0;
        }
        .lp-stepper-idle .lp-step-label {
          color: #94a3b8;
        }
        .lp-stepper-connector {
          flex: 1;
          height: 2.5px;
          background: #e2e8f0;
          margin: 0 10px 18px;
          border-radius: 99px;
          overflow: hidden;
        }
        .lp-connector-fill {
          height: 100%;
          background: linear-gradient(90deg, #4f46e5, #06b6d4);
          transition: width 0.4s ease;
        }
        .lp-connector-full {
          width: 100% !important;
          background: linear-gradient(90deg, #059669, #4f46e5) !important;
        }

        /* BRAND AVATAR HERO */
        .lp-avatar-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          position: relative;
        }
        .lp-avatar-glow-ring {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%);
          filter: blur(12px);
          top: -2px;
          animation: lpAvatarPulse 3s ease-in-out infinite;
        }
        @keyframes lpAvatarPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        .lp-avatar-box {
          position: relative;
          z-index: 2;
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.18), 0 2px 6px rgba(0,0,0,0.04);
        }
        .lp-avatar-img {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }

        /* LIVE STATUS PILL */
        .lp-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .lp-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
          animation: lpLiveSignal 1.5s infinite;
        }
        @keyframes lpLiveSignal {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        /* TYPOGRAPHY */
        .lp-title-group {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .lp-main-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          line-height: 1.2;
          margin: 0;
        }
        @media (min-width: 440px) {
          .lp-main-title {
            font-size: 26px;
          }
        }
        .lp-subtitle {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.55;
          margin: 0;
          font-weight: 500;
        }

        /* FORM */
        .lp-phone-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        /* PHONE INPUT CONTAINER */
        .lp-input-container {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 18px;
          padding: 6px 14px;
          gap: 10px;
          height: 56px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .lp-input-container:focus-within {
          border-color: #4f46e5;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12), 0 4px 14px rgba(79, 70, 229, 0.08);
          transform: translateY(-1px);
        }
        .lp-input-valid {
          border-color: #818cf8;
        }
        .lp-input-error {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12) !important;
        }

        .lp-country-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          user-select: none;
        }
        .lp-country-code {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.01em;
        }
        .lp-input-separator {
          width: 1px;
          height: 24px;
          background: #e2e8f0;
          flex-shrink: 0;
        }
        .lp-text-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.06em;
          font-family: inherit;
        }
        .lp-text-input::placeholder {
          color: #94a3b8;
          font-weight: 500;
          letter-spacing: 0;
          font-size: 14px;
        }
        .lp-input-clear-btn {
          background: #f1f5f9;
          border: none;
          color: #64748b;
          cursor: pointer;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .lp-input-clear-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
          transform: scale(1.08);
        }

        /* DIGIT INDICATOR MICRO-ANIMATION */
        .lp-digit-indicator-wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 4px;
          margin-top: -6px;
        }
        .lp-digit-dots-row {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .lp-digit-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #e2e8f0;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-digit-filled {
          background: #4f46e5;
          width: 12px;
          box-shadow: 0 0 6px rgba(79, 70, 229, 0.5);
        }
        .lp-digit-counter {
          font-size: 11px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.02em;
          transition: color 0.2s;
        }
        .lp-counter-done {
          color: #059669;
          font-weight: 700;
        }

        /* CUSTOM CHECKBOX */
        .lp-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          margin-top: -2px;
        }
        .lp-native-checkbox {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }
        .lp-checkbox-custom {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .lp-native-checkbox:checked + .lp-checkbox-custom {
          background: #4f46e5;
          border-color: #4f46e5;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
        }
        .lp-check-svg {
          width: 13px;
          height: 13px;
          color: #ffffff;
          stroke-width: 2.5;
        }
        .lp-checkbox-caption {
          font-size: 12px;
          color: #64748b;
          line-height: 1.55;
        }
        .lp-checkbox-caption a {
          color: #4f46e5;
          font-weight: 700;
          text-decoration: none;
        }
        .lp-checkbox-caption a:hover {
          text-decoration: underline;
        }

        /* PRIMARY CTA BUTTON & SHINE EFFECT */
        .lp-primary-btn {
          width: 100%;
          height: 52px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #4338ca 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }
        .lp-btn-active-glow {
          box-shadow: 0 8px 24px -4px rgba(79, 70, 229, 0.45), 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .lp-btn-active-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -4px rgba(79, 70, 229, 0.55), 0 4px 10px rgba(15, 23, 42, 0.08);
        }
        .lp-btn-active-glow:active {
          transform: scale(0.98);
        }
        .lp-btn-disabled {
          background: #f1f5f9 !important;
          color: #94a3b8 !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
          border: 1px solid #e2e8f0;
        }

        /* SHINE SWEEP */
        .lp-btn-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -120%;
          width: 80%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transform: skewX(-20deg);
          animation: lpBtnSweep 3.5s infinite;
        }
        .lp-btn-disabled::after {
          display: none;
        }
        @keyframes lpBtnSweep {
          0% { left: -120%; }
          30% { left: 140%; }
          100% { left: 140%; }
        }

        .lp-btn-icon-slide {
          width: 17px;
          height: 17px;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-btn-active-glow:hover .lp-btn-icon-slide {
          transform: translateX(4px);
        }
        .lp-spin-icon {
          width: 18px;
          height: 18px;
          animation: lpSpinAnim 0.75s linear infinite;
        }
        @keyframes lpSpinAnim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* TRUST & BENEFITS HORIZONTAL STRIP */
        .lp-benefits-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 4px;
        }
        .lp-benefit-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 10px 6px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          gap: 6px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-benefit-item:hover {
          background: #ffffff;
          border-color: #cbd5e1;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }
        .lp-benefit-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }
        .lp-icon-blue {
          background: #eff6ff;
          color: #2563eb;
        }
        .lp-icon-amber {
          background: #fffbeb;
          color: #d97706;
        }
        .lp-icon-emerald {
          background: #ecfdf5;
          color: #059669;
        }
        .lp-benefit-text {
          display: flex;
          flex-direction: column;
        }
        .lp-benefit-title {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }
        .lp-benefit-sub {
          font-size: 9.5px;
          color: #64748b;
          line-height: 1.2;
          margin-top: 1px;
        }

        /* ═══════════ STEP 3: OTP SCREEN STYLING ═══════════ */
        .lp-verified-phone-pill {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          width: 100%;
          box-sizing: border-box;
        }
        .lp-pill-prefix {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lp-pill-number {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.04em;
        }
        .lp-change-phone-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #eef2ff;
          border: none;
          color: #4f46e5;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .lp-change-phone-btn:hover {
          background: #e0e7ff;
          transform: scale(1.03);
        }
        .lp-pencil-icon {
          width: 13px;
          height: 13px;
        }

        .lp-member-status-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 700;
          width: 100%;
          box-sizing: border-box;
        }
        .lp-chip-member {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
        }
        .lp-chip-new {
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          color: #5b21b6;
        }
        .lp-chip-icon {
          width: 14px;
          height: 14px;
        }

        /* 6-DIGIT OTP BOXES */
        .lp-otp-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 400px) {
          .lp-otp-wrapper {
            gap: 10px;
          }
        }
        .lp-otp-input-cell {
          width: 46px;
          height: 56px;
          border-radius: 14px;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          outline: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          font-family: inherit;
        }
        @media (min-width: 400px) {
          .lp-otp-input-cell {
            width: 52px;
            height: 62px;
            font-size: 24px;
          }
        }
        .lp-otp-input-cell:focus {
          border-color: #4f46e5;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.15);
          transform: translateY(-2px);
        }
        .lp-otp-cell-filled {
          border-color: #4f46e5 !important;
          background: #f8faff !important;
          color: #4f46e5 !important;
          animation: lpOtpFillPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes lpOtpFillPop {
          0% { transform: scale(0.92); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .lp-otp-cell-loading {
          opacity: 0.6;
        }

        .lp-resend-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
        }
        .lp-timer-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
          font-weight: 600;
        }
        .lp-timer-clock {
          color: #4f46e5;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .lp-link-sep {
          color: #cbd5e1;
        }
        .lp-link-btn {
          background: none;
          border: none;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: color 0.2s;
          font-family: inherit;
        }
        .lp-link-btn:hover {
          color: #0f172a;
          text-decoration: underline;
        }
        .lp-resend-active {
          color: #4f46e5 !important;
          font-weight: 700;
        }
        .lp-inline-icon {
          width: 13px;
          height: 13px;
        }

        /* ═══════════ STEP 4: SUCCESS SCREEN ═══════════ */
        .lp-step-success {
          text-align: center;
          align-items: center;
          gap: 16px;
        }
        .lp-success-visual {
          position: relative;
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 6px 0;
        }
        .lp-success-halo {
          position: absolute;
          border-radius: 50%;
          animation: lpHaloBreathe 3s ease-in-out infinite;
        }
        .lp-halo-outer {
          inset: 0;
          background: rgba(16, 185, 129, 0.12);
        }
        .lp-halo-inner {
          inset: 12px;
          background: rgba(16, 185, 129, 0.18);
          animation-delay: -1s;
        }
        @keyframes lpHaloBreathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.4; }
        }
        .lp-success-badge-icon {
          position: relative;
          z-index: 2;
          width: 68px;
          height: 68px;
          border-radius: 22px;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 36px;
          box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4);
          animation: lpSuccessPop 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lpSuccessPop {
          0% { transform: scale(0.6) rotate(-10deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .lp-verified-pill-success {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 999px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          font-size: 11.5px;
          font-weight: 700;
        }
        .lp-success-cta-btn {
          width: 100%;
          height: 52px;
          border-radius: 16px;
          border: none;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 24px -4px rgba(16, 185, 129, 0.45);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: inherit;
        }
        .lp-success-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -4px rgba(16, 185, 129, 0.55);
        }
        .lp-shopping-icon {
          width: 18px;
          height: 18px;
        }

        /* ═══════════ STEP 1: WELCOME SCREEN STYLING ═══════════ */
        .lp-step-welcome {
          text-align: center;
          align-items: center;
          gap: 16px;
        }
        .lp-welcome-hero-avatar {
          position: relative;
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 4px;
        }
        .lp-hero-pulse-ring-outer {
          position: absolute;
          inset: -6px;
          border-radius: 28px;
          background: rgba(99, 102, 241, 0.12);
          animation: lpHaloBreathe 3s ease-in-out infinite;
        }
        .lp-hero-pulse-ring-inner {
          position: absolute;
          inset: 0px;
          border-radius: 24px;
          background: rgba(99, 102, 241, 0.16);
          animation: lpHaloBreathe 3s ease-in-out infinite -1.5s;
        }
        .lp-hero-logo-box {
          position: relative;
          z-index: 2;
          width: 68px;
          height: 68px;
          border-radius: 20px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px -4px rgba(99, 102, 241, 0.2);
        }
        .lp-welcome-logo-img {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }
        .lp-verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 14px;
          border-radius: 999px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .lp-sparkle-icon {
          width: 14px;
          height: 14px;
          color: #3b82f6;
        }
        .lp-hero-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #0f172a;
          line-height: 1.2;
          margin: 0;
        }
        .lp-hero-desc {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }
        .lp-action-stack {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-secondary-btn {
          width: 100%;
          height: 48px;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .lp-secondary-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .lp-terms-notice {
          font-size: 11.5px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.5;
        }
        .lp-terms-notice a {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 600;
        }
        .lp-terms-notice a:hover {
          text-decoration: underline;
        }

        /* ERROR & SUCCESS ALERTS */
        .lp-error-alert, .lp-success-alert {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 12.5px;
          font-weight: 600;
          line-height: 1.45;
          box-sizing: border-box;
          animation: lpAlertSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes lpAlertSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .lp-error-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }
        .lp-success-alert {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }
        .lp-alert-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* PAGE FOOTER */
        .lp-page-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }
        .lp-footer-trust {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
        }
        .lp-ssl-icon {
          width: 13px;
          height: 13px;
          color: #10b981;
          flex-shrink: 0;
        }
        .lp-footer-links {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11.5px;
        }
        .lp-footer-link {
          color: #64748b;
          text-decoration: none;
          transition: color 0.2s;
        }
        .lp-footer-link:hover {
          color: #4f46e5;
        }
        .lp-footer-dot {
          color: #cbd5e1;
        }

        /* SVG INDIAN FLAG */
        .lp-indian-flag-svg {
          width: 24px;
          height: 16px;
          border-radius: 3px;
          flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </div>
  )
}

/* ── SUB-COMPONENTS ── */

function ErrorAlert({ msg }) {
  return (
    <div className="lp-error-alert" role="alert">
      <HiExclamationTriangle className="lp-alert-icon" />
      <span>{msg}</span>
    </div>
  )
}

function IndianFlag() {
  return (
    <svg className="lp-indian-flag-svg" viewBox="0 0 26 18" fill="none">
      <rect width="26" height="6" fill="#FF9933" />
      <rect y="6" width="26" height="6" fill="#ffffff" />
      <rect y="12" width="26" height="6" fill="#138808" />
      <circle cx="13" cy="9" r="2.5" fill="none" stroke="#000080" strokeWidth="0.7" />
      <circle cx="13" cy="9" r="0.6" fill="#000080" />
    </svg>
  )
}

export default LoginPage
