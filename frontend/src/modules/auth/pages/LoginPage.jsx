import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import {
  HiArrowLeft, HiCheck, HiShieldCheck, HiExclamationTriangle,
  HiArrowPath, HiPencilSquare, HiXMark, HiArrowRight,
  HiShoppingBag, HiSparkles, HiCheckCircle, HiLockClosed, HiBolt,
} from 'react-icons/hi2'
import { USER_ROUTES } from '../../../config/routes'
import { useAuthStore } from '../../../lib/authStore'
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
    setTimeout(() => { setCurrentStep(next); setStepVisible(true) }, 280)
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
    setPhoneNumber(e.target.value.replace(/\D/g,'').slice(0,10))
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

  return (
    <div className="lp-root">
      {/* ═══════════ ANIMATED BG ═══════════ */}
      <div className="lp-bg" aria-hidden>
        <div className="lp-orb lp-orb1" />
        <div className="lp-orb lp-orb2" />
        <div className="lp-orb lp-orb3" />
        <div className="lp-mesh" />
      </div>

      {/* ═══════════ HEADER ═══════════ */}
      <header className="lp-header">
        <div className="lp-header-inner">
          {currentStep > 1
            ? <button className="lp-icon-btn" onClick={goBack} aria-label="Back">
                <HiArrowLeft style={{width:18,height:18}} />
              </button>
            : <div style={{width:40}} />
          }

          <Link to={USER_ROUTES.DASHBOARD} className="lp-logo-link">
            <img src="/images/logo.png" alt="KroZenda" className="lp-logo" />
            <span className="lp-brand">KroZenda</span>
          </Link>

          <button className="lp-ghost-pill" onClick={() => navigate(USER_ROUTES.DASHBOARD, {replace:true})}>
            Guest <HiArrowRight style={{width:13,height:13}} />
          </button>
        </div>
      </header>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="lp-main">

        {/* ── Floating card ── */}
        <div className="lp-card lp-card-enter">

          {/* Rainbow stripe */}
          <div className="lp-stripe" aria-hidden />

          {/* Step content wrapper — fades on transition */}
          <div className={`lp-step-body ${stepVisible ? 'lp-visible' : 'lp-hidden'}`}>

            {/* ════ STEP 1: WELCOME ════ */}
            {currentStep === 1 && (
              <div className="lp-step">
                <div className="lp-welcome-icon">
                  <div className="lp-pulse-ring" />
                  <img src="/images/logo.png" alt="KroZenda" className="lp-welcome-logo" />
                </div>

                <span className="lp-chip lp-chip-amber">
                  <HiBolt style={{width:11,height:11}} /> INDIA'S #1 DROPSHIPPING
                </span>

                <h1 className="lp-heading">Smart Factory<br/>Commerce</h1>
                <p className="lp-sub">Connect directly with manufacturers.<br/>Unit wholesale prices. Pan-India 24–48hr.</p>

                <div className="lp-btn-stack">
                  <button className="lp-btn-primary lp-btn-anim" onClick={() => changeStep(2)}>
                    <span>Sign In with Mobile</span>
                    <span className="lp-btn-icon"><HiArrowRight /></span>
                  </button>
                  <button className="lp-btn-outline" onClick={() => navigate(USER_ROUTES.DASHBOARD,{replace:true})}>
                    Explore as Guest
                  </button>
                </div>

                <p className="lp-fine">
                  By continuing you agree to our{' '}
                  <Link to="/terms" target="_blank">Terms</Link> &amp;{' '}
                  <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>
                </p>
              </div>
            )}

            {/* ════ STEP 2: MOBILE INPUT ════ */}
            {currentStep === 2 && (
              <div className="lp-step">
                {/* Step progress */}
                <div className="lp-progress">
                  <StepBubble num={1} label="Mobile" state="active" />
                  <div className="lp-prog-line lp-prog-line-half" />
                  <StepBubble num={2} label="Verify" state="idle" />
                </div>

                {/* Animated logo area */}
                <div className="lp-icon-hero">
                  <div className="lp-icon-bg" />
                  <div className="lp-icon-wrap">
                    <img src="/images/logo.png" alt="" className="lp-icon-img" />
                  </div>
                </div>

                <h1 className="lp-heading lp-stagger-1">Enter Your Mobile</h1>
                <p className="lp-sub lp-stagger-2">We'll send a 6-digit OTP. No password needed.</p>

                {error && <ErrorAlert msg={error} />}

                <form onSubmit={handleMobileSubmit} className="lp-form lp-stagger-3">
                  {/* Floating label phone input */}
                  <div className={`lp-phone-wrap ${error ? 'lp-phone-error' : ''}`}>
                    <div className="lp-phone-prefix">
                      <IndianFlag />
                      <span className="lp-prefix-code">+91</span>
                    </div>
                    <div className="lp-vdivider" />
                    <input
                      id="mobile-input"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      disabled={isLoading}
                      autoFocus
                      className="lp-phone-input"
                    />
                    {phoneNumber && !isLoading && (
                      <button type="button" className="lp-clear"
                        onClick={() => { setPhoneNumber(''); setError(null) }}>
                        <HiXMark style={{width:15,height:15}} />
                      </button>
                    )}
                  </div>

                  {/* Animated fill bar */}
                  <div className="lp-fill-bar">
                    <div className="lp-fill-track">
                      <div className="lp-fill-progress"
                        style={{ width: `${(phoneNumber.length / 10) * 100}%` }} />
                    </div>
                    <span className="lp-fill-count">{phoneNumber.length}/10</span>
                  </div>

                  {/* Terms checkbox */}
                  <label className="lp-terms">
                    <input type="checkbox" checked={acceptedTerms} className="lp-check"
                      onChange={e => { setAcceptedTerms(e.target.checked); if(error && e.target.checked) setError(null) }} />
                    <span className="lp-terms-text">
                      I agree to <Link to="/terms" target="_blank">Terms</Link> &amp; <Link to="/privacy-policy" target="_blank">Privacy Policy</Link>
                    </span>
                  </label>

                  <button type="submit"
                    className={`lp-btn-primary lp-btn-anim ${(isLoading || phoneNumber.length !== 10) ? 'lp-btn-dim' : ''}`}
                    disabled={isLoading || phoneNumber.length !== 10}>
                    {isLoading
                      ? <><HiArrowPath className="lp-spin" style={{width:18,height:18}} /> <span>Sending OTP…</span></>
                      : <><span>Get OTP</span> <span className="lp-btn-icon"><HiArrowRight /></span></>
                    }
                  </button>
                </form>

                {/* OTP badge */}
                <div className="lp-otp-badge lp-stagger-4">
                  <span className="lp-live-dot" />
                  Instant OTP &bull; No password &bull; Auto sign-up
                </div>

                {/* Trust grid */}
                <div className="lp-trust-grid lp-stagger-5">
                  {[
                    { icon: <HiShieldCheck />, label: '100% Secure' },
                    { icon: <HiBolt />,         label: 'Instant Login' },
                    { icon: <HiLockClosed />,   label: 'SSL Encrypted' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="lp-trust-chip">
                      <span className="lp-trust-ico">{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ════ STEP 3: OTP ════ */}
            {currentStep === 3 && (
              <div className="lp-step">
                <div className="lp-progress">
                  <StepBubble num={1} label="Mobile" state="done" />
                  <div className="lp-prog-line lp-prog-line-full" />
                  <StepBubble num={2} label="Verify" state="active" />
                </div>

                {/* Phone badge */}
                <div className="lp-phone-badge lp-stagger-1">
                  <span>+91 {phoneNumber}</span>
                  <button className="lp-edit-btn"
                    onClick={() => { setError(null); changeStep(2) }}>
                    <HiPencilSquare style={{width:14,height:14}} />
                  </button>
                </div>

                <h1 className="lp-heading lp-stagger-2">Enter OTP</h1>
                <p className="lp-sub lp-stagger-3">6-digit code sent to your mobile</p>

                {isRegistered !== null && (
                  <div className={`lp-status-chip lp-stagger-3 ${isRegistered ? 'lp-status-green' : 'lp-status-violet'}`}>
                    {isRegistered
                      ? <><HiShieldCheck style={{width:14,height:14}} /> Existing Member</>
                      : <><HiSparkles style={{width:14,height:14}} /> New Account — Auto Created</>}
                  </div>
                )}

                {error && <ErrorAlert msg={error} />}
                {resendNotice && (
                  <div className="lp-success-toast">
                    <HiCheckCircle style={{width:15,height:15}} /> {resendNotice}
                  </div>
                )}

                {/* OTP boxes */}
                <div className="lp-otp-row lp-stagger-4" onPaste={handleOtpPaste}>
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
                      className={`lp-otp-box ${digit ? 'lp-otp-filled' : ''} ${isLoading ? 'lp-otp-loading' : ''}`}
                    />
                  ))}
                </div>

                <button
                  className={`lp-btn-primary lp-btn-anim lp-stagger-5 ${(isLoading || !isOtpComplete) ? 'lp-btn-dim' : ''}`}
                  disabled={isLoading || !isOtpComplete}
                  onClick={() => verifyOtpCode(otp.join(''))}>
                  {isLoading
                    ? <><HiArrowPath className="lp-spin" style={{width:18,height:18}} /> <span>Verifying…</span></>
                    : <><span>Verify &amp; Login</span> <span className="lp-btn-icon"><HiArrowRight /></span></>}
                </button>

                <div className="lp-resend-area">
                  {timer > 0
                    ? <span className="lp-timer">Resend in <strong>{fmt(timer)}</strong></span>
                    : <button className="lp-text-btn" onClick={handleResendOtp}>
                        <HiArrowPath style={{width:13,height:13}} /> Resend OTP
                      </button>
                  }
                  <span className="lp-dot-sep">·</span>
                  <button className="lp-text-btn" onClick={() => { setError(null); changeStep(2) }}>
                    Change number
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 4: SUCCESS ════ */}
            {currentStep === 4 && (
              <div className="lp-step lp-step-center">
                <div className="lp-success-anim">
                  <div className="lp-s-ring lp-s-ring1" />
                  <div className="lp-s-ring lp-s-ring2" />
                  <div className="lp-s-icon">
                    <HiShieldCheck style={{width:38,height:38,color:'#fff'}} />
                  </div>
                </div>

                <span className="lp-chip lp-chip-green">
                  <HiSparkles style={{width:11,height:11}} />
                  {isNewUser ? 'Account Activated!' : 'Welcome Back!'}
                </span>

                <h1 className="lp-heading">
                  {userProfile?.name ? `Hi, ${userProfile.name}!` : "You're In!"}
                </h1>
                <p className="lp-sub">
                  Verified: <strong style={{color:'#1e293b'}}>+91 {phoneNumber}</strong><br/>
                  Full access to factory wholesale rates.
                </p>

                <button className="lp-btn-success lp-btn-anim"
                  onClick={() => navigate(returnUrl, {replace:true})}>
                  <HiShoppingBag style={{width:18,height:18}} />
                  <span>Continue to Marketplace</span>
                </button>
              </div>
            )}

          </div>{/* /lp-step-body */}
        </div>{/* /lp-card */}

        {/* Footer */}
        <footer className="lp-footer">
          <HiLockClosed style={{width:11,height:11,color:'#22c55e'}} />
          256-Bit SSL &bull; Safe Escrow &bull; GST Invoiced
          <span className="lp-footer-sep">|</span>
          <Link to="/terms" target="_blank">Terms</Link>
          <Link to="/privacy-policy" target="_blank">Privacy</Link>
        </footer>
      </main>

      {/* ════ SCOPED CSS ════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        /* ROOT */
        .lp-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', system-ui, sans-serif;
          background: #f0f4ff;
          color: #1e293b;
          overflow-x: hidden;
          position: relative;
        }

        /* ANIMATED BACKGROUND */
        .lp-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: lpFloat 16s ease-in-out infinite;
        }
        .lp-orb1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(165,180,252,0.45) 0%, transparent 70%);
          top: -200px; left: -200px;
          animation-delay: 0s;
        }
        .lp-orb2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(196,181,253,0.4) 0%, transparent 70%);
          bottom: -150px; right: -150px;
          animation-delay: -6s;
        }
        .lp-orb3 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(147,197,253,0.35) 0%, transparent 70%);
          top: 45%; left: 55%;
          transform: translate(-50%,-50%);
          animation-delay: -12s;
        }
        .lp-mesh {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle at 1px 1px, rgba(99,102,241,0.06) 1px, transparent 0);
          background-size: 30px 30px;
        }
        @keyframes lpFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-35px) scale(1.06); }
        }

        /* HEADER */
        .lp-header {
          position: relative; z-index: 20;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(99,102,241,0.1);
          box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(99,102,241,0.06);
        }
        .lp-header-inner {
          max-width: 480px; margin: 0 auto;
          padding: 13px 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-icon-btn {
          width: 38px; height: 38px;
          border-radius: 50%;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .lp-icon-btn:hover { background: #f8fafc; color: #4f46e5; border-color: #c7d2fe; transform: scale(1.05); }
        .lp-icon-btn:active { transform: scale(0.95); }

        .lp-logo-link { display: flex; align-items: center; gap: 9px; text-decoration: none; }
        .lp-logo { height: 28px; width: auto; object-fit: contain; border-radius: 6px; }
        .lp-brand {
          font-size: 14px; font-weight: 900; letter-spacing: 0.12em;
          text-transform: uppercase; color: #1e293b;
        }

        .lp-ghost-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 999px;
          border: 1.5px solid #c7d2fe; background: #eef2ff;
          color: #4f46e5; font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
        }
        .lp-ghost-pill:hover { background: #e0e7ff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.2); }
        .lp-ghost-pill:active { transform: scale(0.97); }

        /* MAIN */
        .lp-main {
          position: relative; z-index: 10; flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 24px 16px 20px; gap: 16px;
        }

        /* CARD */
        .lp-card {
          width: 100%; max-width: 430px;
          background: #fff;
          border-radius: 28px;
          border: 1px solid rgba(199,210,254,0.8);
          box-shadow:
            0 0 0 1px rgba(255,255,255,1) inset,
            0 20px 60px rgba(99,102,241,0.14),
            0 4px 20px rgba(0,0,0,0.06);
          overflow: hidden;
        }
        .lp-card-enter {
          animation: lpCardEnter 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes lpCardEnter {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* RAINBOW STRIPE */
        .lp-stripe {
          height: 4px;
          background: linear-gradient(90deg, #6366f1 0%, #3b82f6 35%, #06b6d4 65%, #8b5cf6 100%);
          background-size: 200% 100%;
          animation: lpStripe 4s linear infinite;
        }
        @keyframes lpStripe {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }

        /* STEP BODY FADE */
        .lp-step-body { transition: opacity 0.25s ease, transform 0.25s ease; }
        .lp-visible { opacity: 1; transform: translateY(0); }
        .lp-hidden  { opacity: 0; transform: translateY(8px); }

        /* STEP WRAPPER */
        .lp-step {
          padding: 28px 28px 32px;
          display: flex; flex-direction: column; align-items: center;
          gap: 16px;
        }
        @media (min-width: 420px) { .lp-step { padding: 32px 36px 36px; } }
        .lp-step-center { text-align: center; }

        /* STAGGER ANIMATIONS */
        .lp-stagger-1 { animation: lpFadeUp 0.4s 0.05s both; }
        .lp-stagger-2 { animation: lpFadeUp 0.4s 0.12s both; }
        .lp-stagger-3 { animation: lpFadeUp 0.4s 0.18s both; }
        .lp-stagger-4 { animation: lpFadeUp 0.4s 0.24s both; }
        .lp-stagger-5 { animation: lpFadeUp 0.4s 0.30s both; }
        @keyframes lpFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* STEP PROGRESS */
        .lp-progress {
          display: flex; align-items: flex-start; gap: 0;
          width: 100%; max-width: 210px;
          animation: lpFadeUp 0.4s both;
        }
        .lp-prog-line {
          flex: 1; height: 2px; margin-top: 14px;
          border-radius: 99px; transition: background 0.4s;
        }
        .lp-prog-line-half { background: linear-gradient(90deg, #4f46e5, #e2e8f0 60%); }
        .lp-prog-line-full { background: linear-gradient(90deg, #059669, #4f46e5); }

        /* CHIPS */
        .lp-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 999px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
          animation: lpFadeUp 0.4s both;
        }
        .lp-chip-amber {
          background: #fffbeb; border: 1px solid #fcd34d; color: #92400e;
        }
        .lp-chip-green {
          background: #ecfdf5; border: 1px solid #86efac; color: #166534;
        }

        /* WELCOME ICON */
        .lp-welcome-icon {
          position: relative;
          width: 88px; height: 88px;
          display: flex; align-items: center; justify-content: center;
          animation: lpFadeUp 0.5s both;
        }
        .lp-pulse-ring {
          position: absolute; inset: -8px;
          border-radius: 28px;
          background: linear-gradient(135deg, #eef2ff, #e0e7ff);
          animation: lpPulseRing 2.5s ease-in-out infinite;
        }
        @keyframes lpPulseRing {
          0%,100% { transform: scale(1); opacity: 0.8; }
          50%      { transform: scale(1.06); opacity: 0.5; }
        }
        .lp-welcome-logo {
          width: 64px; height: 64px; object-fit: contain; border-radius: 16px;
          position: relative; z-index: 2;
          box-shadow: 0 8px 24px rgba(99,102,241,0.2);
        }

        /* ICON HERO */
        .lp-icon-hero {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          margin: 4px 0;
          animation: lpFadeUp 0.4s both;
        }
        .lp-icon-bg {
          position: absolute;
          width: 110px; height: 110px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
          filter: blur(14px);
          animation: lpPulseRing 3s ease-in-out infinite;
        }
        .lp-icon-wrap {
          width: 76px; height: 76px; border-radius: 24px;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border: 2px solid #c7d2fe;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 6px rgba(199,210,254,0.2), 0 10px 28px rgba(99,102,241,0.2);
          position: relative; z-index: 2;
          transition: transform 0.3s;
        }
        .lp-icon-wrap:hover { transform: scale(1.04) rotate(-1deg); }
        .lp-icon-img { width: 46px; height: 46px; object-fit: contain; border-radius: 12px; }

        /* TYPOGRAPHY */
        .lp-heading {
          font-size: 26px; font-weight: 900; letter-spacing: -0.04em;
          text-align: center; margin: 0; line-height: 1.1;
          background: linear-gradient(135deg, #1e40af 0%, #4f46e5 60%, #7c3aed 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @media (min-width: 420px) { .lp-heading { font-size: 30px; } }
        .lp-sub {
          font-size: 13.5px; color: #94a3b8; text-align: center;
          margin: -6px 0 0; line-height: 1.6; font-weight: 500;
        }

        /* FORM */
        .lp-form { width: 100%; display: flex; flex-direction: column; gap: 14px; }

        /* PHONE INPUT */
        .lp-phone-wrap {
          display: flex; align-items: center;
          background: #f8faff;
          border: 2px solid #e8eeff; border-radius: 18px;
          padding: 14px 18px; gap: 12px;
          transition: all 0.25s;
          box-shadow: 0 2px 8px rgba(99,102,241,0.05);
        }
        .lp-phone-wrap:focus-within {
          border-color: #6366f1; background: #fafbff;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.1), 0 2px 8px rgba(99,102,241,0.08);
          transform: translateY(-1px);
        }
        .lp-phone-error {
          border-color: #f87171 !important;
          box-shadow: 0 0 0 4px rgba(239,68,68,0.1) !important;
        }
        .lp-phone-prefix { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .lp-prefix-code { font-size: 15px; font-weight: 800; color: #374151; letter-spacing: 0.02em; }
        .lp-vdivider { width: 1px; height: 22px; background: #e2e8f0; flex-shrink: 0; }
        .lp-phone-input {
          flex: 1; min-width: 0; background: transparent; border: none; outline: none;
          font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: 0.08em;
          caret-color: #4f46e5; font-family: inherit;
        }
        .lp-phone-input::placeholder { color: #cbd5e1; font-weight: 500; letter-spacing: 0; }
        .lp-clear {
          background: none; border: none; color: #94a3b8; cursor: pointer;
          padding: 3px; display: flex; align-items: center; transition: all 0.2s; flex-shrink: 0;
          border-radius: 50%;
        }
        .lp-clear:hover { color: #475569; background: #f1f5f9; }

        /* FILL BAR */
        .lp-fill-bar { display: flex; align-items: center; gap: 8px; margin-top: -6px; }
        .lp-fill-track {
          flex: 1; height: 3px; background: #f1f5f9; border-radius: 99px; overflow: hidden;
        }
        .lp-fill-progress {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #3b82f6, #6366f1);
          transition: width 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .lp-fill-count { font-size: 11px; color: #94a3b8; font-weight: 600; flex-shrink: 0; }

        /* TERMS */
        .lp-terms { display: flex; align-items: flex-start; gap: 9px; cursor: pointer; }
        .lp-check {
          margin-top: 1px; width: 16px; height: 16px;
          accent-color: #4f46e5; cursor: pointer; flex-shrink: 0; border-radius: 4px;
        }
        .lp-terms-text { font-size: 12px; color: #64748b; line-height: 1.6; }
        .lp-terms-text a { color: #4f46e5; font-weight: 700; text-decoration: none; }
        .lp-terms-text a:hover { text-decoration: underline; }

        /* BUTTONS */
        .lp-btn-stack { width: 100%; display: flex; flex-direction: column; gap: 10px; }

        .lp-btn-primary {
          width: 100%; height: 54px; border-radius: 18px; border: none;
          background: linear-gradient(135deg, #3b82f6 0%, #4f46e5 100%);
          color: #fff; font-size: 15px; font-weight: 800; letter-spacing: 0.01em;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          position: relative; overflow: hidden;
          box-shadow: 0 8px 24px rgba(79,70,229,0.35), 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.25s;
          font-family: inherit;
        }
        .lp-btn-primary::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.25) 50%, transparent 65%);
          background-size: 200% 100%; background-position: -100% 0;
          transition: background-position 0.5s;
        }
        .lp-btn-anim:hover:not(.lp-btn-dim)::after { background-position: 100% 0; }
        .lp-btn-anim:hover:not(.lp-btn-dim) {
          transform: translateY(-2px);
          box-shadow: 0 14px 32px rgba(79,70,229,0.45), 0 4px 12px rgba(0,0,0,0.12);
        }
        .lp-btn-anim:active:not(.lp-btn-dim) { transform: scale(0.98); }
        .lp-btn-icon { display: flex; align-items: center; }
        .lp-btn-icon svg { width: 18px; height: 18px; transition: transform 0.2s; }
        .lp-btn-anim:hover:not(.lp-btn-dim) .lp-btn-icon svg { transform: translateX(3px); }

        .lp-btn-dim {
          background: #f1f5f9 !important; color: #94a3b8 !important;
          box-shadow: none !important; cursor: not-allowed !important;
          transform: none !important; border: 1px solid #e2e8f0;
        }
        .lp-btn-dim::after { display: none; }

        .lp-btn-outline {
          width: 100%; height: 48px; border-radius: 16px;
          border: 1.5px solid #e2e8f0; background: #f8fafc;
          color: #475569; font-size: 14px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; font-family: inherit;
        }
        .lp-btn-outline:hover { background: #f1f5f9; border-color: #cbd5e1; color: #1e293b; transform: translateY(-1px); }

        .lp-btn-success {
          width: 100%; height: 54px; border-radius: 18px; border: none;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          color: #fff; font-size: 15px; font-weight: 800;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
          position: relative; overflow: hidden;
          box-shadow: 0 8px 24px rgba(5,150,105,0.35);
          transition: all 0.25s; font-family: inherit;
        }
        .lp-btn-success:hover { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(5,150,105,0.45); }

        /* OTP BADGE */
        .lp-otp-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 14px;
          background: #eef2ff; border: 1px solid #c7d2fe;
          color: #4338ca; font-size: 12px; font-weight: 600;
          width: 100%; justify-content: center;
        }
        .lp-live-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #4f46e5; flex-shrink: 0;
          animation: lpLivePulse 1.4s ease-in-out infinite;
        }
        @keyframes lpLivePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.7); }
        }

        /* TRUST GRID */
        .lp-trust-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; width: 100%; }
        .lp-trust-chip {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 12px 6px; border-radius: 14px;
          background: #f8fafc; border: 1.5px solid #f1f5f9;
          font-size: 10px; font-weight: 600; color: #64748b; text-align: center;
          transition: all 0.2s; cursor: default;
        }
        .lp-trust-chip:hover {
          background: #eef2ff; border-color: #c7d2fe; color: #4f46e5;
          transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.12);
        }
        .lp-trust-ico {
          width: 30px; height: 30px; border-radius: 9px;
          background: #eef2ff; display: flex; align-items: center; justify-content: center;
          color: #4f46e5; transition: all 0.2s;
        }
        .lp-trust-ico svg { width: 15px; height: 15px; }
        .lp-trust-chip:hover .lp-trust-ico { background: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.2); }

        /* PHONE BADGE (step 3) */
        .lp-phone-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 16px; border-radius: 999px;
          background: #f8fafc; border: 1.5px solid #e2e8f0;
          font-size: 14px; font-weight: 700; color: #334155;
          transition: all 0.2s;
        }
        .lp-edit-btn {
          background: none; border: none; color: #6366f1;
          cursor: pointer; display: flex; align-items: center; padding: 2px;
          transition: all 0.2s; border-radius: 4px;
        }
        .lp-edit-btn:hover { color: #4338ca; background: #eef2ff; transform: scale(1.1); }

        /* STATUS CHIP */
        .lp-status-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 999px;
          font-size: 12px; font-weight: 700;
        }
        .lp-status-green  { background: #ecfdf5; border: 1px solid #86efac; color: #166534; }
        .lp-status-violet { background: #f5f3ff; border: 1px solid #ddd6fe; color: #5b21b6; }

        /* OTP BOXES */
        .lp-otp-row {
          display: flex; gap: 10px; justify-content: center; width: 100%;
        }
        @media (min-width: 380px) { .lp-otp-row { gap: 12px; } }
        .lp-otp-box {
          width: 46px; height: 56px;
          border-radius: 16px;
          border: 2px solid #e8eeff;
          background: #f8faff;
          color: #1e293b; font-size: 22px; font-weight: 900;
          text-align: center; caret-color: transparent; outline: none;
          transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          font-family: inherit;
        }
        @media (min-width: 380px) { .lp-otp-box { width: 52px; height: 62px; } }
        .lp-otp-box:focus {
          border-color: #6366f1; background: #fafbff;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.14);
          transform: scale(1.06);
        }
        .lp-otp-filled {
          border-color: #3b82f6 !important;
          background: linear-gradient(135deg, #eff6ff, #eef2ff) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.18) !important;
          color: #1d4ed8 !important;
          transform: scale(1.04);
          animation: lpOtpPop 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes lpOtpPop {
          0%  { transform: scale(0.9); }
          100%{ transform: scale(1.04); }
        }
        .lp-otp-loading { opacity: 0.6; animation: lpShimmer 1.2s ease-in-out infinite; }
        @keyframes lpShimmer {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 0.3; }
        }

        /* RESEND */
        .lp-resend-area {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
        }
        .lp-timer { font-size: 13px; color: #94a3b8; font-weight: 600; }
        .lp-timer strong { color: #4f46e5; font-family: monospace; }
        .lp-dot-sep { color: #cbd5e1; }
        .lp-text-btn {
          background: none; border: none; color: #4f46e5; font-size: 13px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
          transition: all 0.2s; font-family: inherit; border-radius: 4px; padding: 2px 4px;
        }
        .lp-text-btn:hover { color: #3730a3; text-decoration: underline; }

        /* ERROR / SUCCESS */
        .lp-error-toast, .lp-success-toast {
          width: 100%; display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 14px;
          font-size: 13px; font-weight: 600; line-height: 1.5;
          animation: lpFadeUp 0.3s both;
        }
        .lp-error-toast {
          background: #fff0f0; border: 1px solid #fecaca; color: #b91c1c;
        }
        .lp-success-toast {
          background: #f0fdf4; border: 1px solid #86efac; color: #166534;
        }

        /* SUCCESS SCREEN */
        .lp-success-anim {
          position: relative; width: 130px; height: 130px;
          display: flex; align-items: center; justify-content: center;
          animation: lpFadeUp 0.5s both;
        }
        .lp-s-ring {
          position: absolute; border-radius: 50%;
          animation: lpSuccessRing 2.5s ease-in-out infinite;
        }
        .lp-s-ring1 { inset: 0; background: rgba(5,150,105,0.08); animation-delay: 0s; }
        .lp-s-ring2 { inset: 14px; background: rgba(5,150,105,0.12); animation-delay: -0.5s; }
        @keyframes lpSuccessRing {
          0%,100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.08); opacity: 0.4; }
        }
        .lp-s-icon {
          width: 78px; height: 78px; border-radius: 22px;
          background: linear-gradient(135deg, #059669 0%, #0d9488 100%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 14px 40px rgba(5,150,105,0.38);
          position: relative; z-index: 2;
          animation: lpSuccessIcon 0.6s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes lpSuccessIcon {
          from { transform: scale(0.5) rotate(-10deg); opacity: 0; }
          to   { transform: scale(1) rotate(0); opacity: 1; }
        }

        /* FINE PRINT */
        .lp-fine { font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.7; }
        .lp-fine a { color: #4f46e5; font-weight: 700; text-decoration: none; }
        .lp-fine a:hover { text-decoration: underline; }

        /* FOOTER */
        .lp-footer {
          position: relative; z-index: 10;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center;
          font-size: 11px; color: #94a3b8; font-weight: 500;
        }
        .lp-footer-sep { color: #e2e8f0; }
        .lp-footer a { color: #94a3b8; text-decoration: none; transition: color 0.2s; }
        .lp-footer a:hover { color: #4f46e5; }

        /* SPINNER */
        .lp-spin { animation: lpSpinAnim 0.7s linear infinite; }
        @keyframes lpSpinAnim {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* INDIA FLAG */
        .lp-flag { width: 26px; height: 18px; border-radius: 3px; flex-shrink: 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }
      `}</style>
    </div>
  )
}

/* ── Sub-components ── */

function StepBubble({ num, label, state }) {
  const styles = {
    active: { bg: 'linear-gradient(135deg,#3b82f6,#4f46e5)', color:'#fff', shadow:'0 4px 14px rgba(79,70,229,0.4)', labelColor:'#4f46e5' },
    done:   { bg: 'linear-gradient(135deg,#059669,#0d9488)', color:'#fff', shadow:'0 4px 14px rgba(5,150,105,0.35)', labelColor:'#059669' },
    idle:   { bg: '#f1f5f9', color:'#94a3b8', border:'1.5px solid #e2e8f0', shadow:'none', labelColor:'#94a3b8' },
  }
  const s = styles[state]
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
      <div style={{
        width:30, height:30, borderRadius:'50%',
        background: s.bg, color: s.color,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, fontWeight:900,
        boxShadow: s.shadow,
        border: s.border || 'none',
        transition:'all 0.3s',
      }}>
        {state === 'done'
          ? <HiCheck style={{width:13,height:13,strokeWidth:3}} />
          : num
        }
      </div>
      <span style={{ fontSize:10, fontWeight:700, color: s.labelColor, letterSpacing:'0.02em', transition:'color 0.3s' }}>
        {label}
      </span>
    </div>
  )
}

function ErrorAlert({ msg }) {
  return (
    <div className="lp-error-toast" role="alert">
      <HiExclamationTriangle style={{width:16,height:16,flexShrink:0,marginTop:1}} />
      <span>{msg}</span>
    </div>
  )
}

function IndianFlag() {
  return (
    <svg className="lp-flag" viewBox="0 0 26 18" fill="none">
      <rect width="26" height="6"  fill="#FF9933" />
      <rect y="6"  width="26" height="6" fill="#fff" />
      <rect y="12" width="26" height="6" fill="#138808" />
      <circle cx="13" cy="9" r="2.5" fill="none" stroke="#000080" strokeWidth="0.7"/>
      <circle cx="13" cy="9" r="0.6" fill="#000080"/>
    </svg>
  )
}

export default LoginPage
