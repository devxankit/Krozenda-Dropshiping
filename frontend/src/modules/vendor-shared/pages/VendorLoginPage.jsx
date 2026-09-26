import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HiOutlineEnvelope,
  HiOutlineLockClosed,
  HiOutlineBuildingOffice2,
  HiOutlineUser,
  HiEye,
  HiEyeSlash,
  HiOutlineKey,
  HiOutlineArrowRight,
} from 'react-icons/hi2'
import { VendorAuthShell as VendorLoginShell } from '../components/shell/VendorAuthShell'
import { useAuthStore } from '../../../lib/authStore'
import { toast } from '../../admin/stores/toastStore'
import {
  useVendorForgotPasswordController,
  useVendorLoginController,
  useVendorPushRegistration,
  useVendorResetPasswordController,
} from '../controllers/useVendorController'

const DEMO_CREDENTIALS = {
  B2C: {
    email: 'b2c.demo@krozenda.com',
    password: 'Demo@1234',
    label: 'Individual Seller (B2C)',
    badge: 'No GST Required',
  },
  B2B: {
    email: 'b2b.demo@krozenda.com',
    password: 'Demo@1234',
    label: 'Registered Business (B2B)',
    badge: 'GST & ITC Ready',
  },
}

export function VendorLoginPage({ mode = 'seller' }) {
  if (mode === 'partner') return <PartnerDemoLoginPage />
  return <SellerLoginPage />
}

function SellerLoginPage() {
  const navigate = useNavigate()
  const registerPushToken = useVendorPushRegistration()
  const { login, isSubmitting } = useVendorLoginController()
  const [vendorType, setVendorType] = useState('B2C')
  const [email, setEmail] = useState(DEMO_CREDENTIALS.B2C.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.B2C.password)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [view, setView] = useState('login') // 'login' | 'forgot'

  function handleTypeSwitch(nextType) {
    setVendorType(nextType)
    setEmail(DEMO_CREDENTIALS[nextType].email)
    setPassword(DEMO_CREDENTIALS[nextType].password)
    setError(null)
    setErrorCode(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setErrorCode(null)

    try {
      const { token, vendor } = await login({ email, password })

      useAuthStore.getState().setSession({
        user: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          storeName: vendor.business?.businessName || vendor.name,
          entityType: vendor.vendorType === 'B2B' ? 'Registered Business' : 'Individual Seller',
          language: vendor.language ?? null,
        },
        roles: ['seller', vendor.vendorType === 'B2B' ? 'b2b_seller' : 'b2c_seller'],
        permissions: ['seller.access', 'vendor.access'],
        accessToken: token,
      })

      registerPushToken()
      toast.success('Signed in', `Welcome back, ${vendor.name}.`)
      navigate('/seller/dashboard')
    } catch (err) {
      const message =
        err?.message ||
        err?.response?.data?.message ||
        'Unable to sign in. Please verify your credentials or check your account status.'
      const code = err?.code || err?.response?.data?.code || null
      setError(message)
      setErrorCode(code)
      if (code === 'VERIFICATION_PENDING') {
        toast.warning('Account Under Review', message)
      } else if (code === 'VERIFICATION_REJECTED') {
        toast.error('Application Rejected', message)
      } else if (code === 'ACCOUNT_INACTIVE') {
        toast.error('Account Deactivated', message)
      } else {
        toast.error('Sign in failed', message)
      }
    }
  }

  if (view === 'forgot') {
    return (
      <VendorLoginShell
        title="Reset Password"
        subtitle="Enter your email to receive a 6-digit recovery code"
      >
        <ForgotPasswordFlow
          initialEmail={email}
          onDone={(resetEmail) => {
            setEmail(resetEmail)
            setPassword('')
            setView('login')
          }}
          onCancel={() => setView('login')}
        />
      </VendorLoginShell>
    )
  }

  return (
    <VendorLoginShell
      title="Sign in to Seller Portal"
      subtitle="Manage your products, orders, inventory and payouts"
    >
      {/* Clean Segmented Tab Switcher */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Seller Account Type
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          {(['B2C', 'B2B']).map((type) => {
            const isSelected = vendorType === type
            const IconComp = type === 'B2B' ? HiOutlineBuildingOffice2 : HiOutlineUser
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSwitch(type)}
                className={`py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span>{type} Seller</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Email Address <span className="text-danger-500">*</span>
          </label>
          <div className="relative flex items-center">
            <HiOutlineEnvelope className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seller@example.com"
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 placeholder:text-slate-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs transition-all outline-none font-medium"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-700">
              Password <span className="text-danger-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative flex items-center">
            <HiOutlineLockClosed className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 placeholder:text-slate-400 rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all outline-none font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
              errorCode === 'VERIFICATION_PENDING'
                ? 'bg-warning-50 border-warning-300 text-warning-900'
                : errorCode === 'VERIFICATION_REJECTED'
                  ? 'bg-danger-50 border-danger-300 text-danger-900'
                  : errorCode === 'ACCOUNT_INACTIVE'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-danger-50 border-danger-200 text-danger-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                errorCode === 'VERIFICATION_PENDING'
                  ? 'bg-warning-500'
                  : errorCode === 'VERIFICATION_REJECTED'
                    ? 'bg-danger-500'
                    : errorCode === 'ACCOUNT_INACTIVE'
                      ? 'bg-slate-500'
                      : 'bg-danger-600'
              }`}
            />
            <div className="flex-1">
              {errorCode === 'VERIFICATION_PENDING' && (
                <strong className="font-bold block text-xs mb-0.5 text-warning-900">
                  Account Under Review
                </strong>
              )}
              {errorCode === 'VERIFICATION_REJECTED' && (
                <strong className="font-bold block text-xs mb-0.5 text-danger-900">
                  Application Needs Attention
                </strong>
              )}
              {errorCode === 'ACCOUNT_INACTIVE' && (
                <strong className="font-bold block text-xs mb-0.5 text-slate-900">
                  Account Deactivated
                </strong>
              )}
              <span className="leading-relaxed block">{error}</span>
            </div>
          </div>
        )}

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all disabled:opacity-60 flex items-center justify-center space-x-1.5 text-xs"
        >
          {isSubmitting ? (
            <span>Signing in…</span>
          ) : (
            <>
              <span>Sign In as {vendorType} Seller</span>
              <HiOutlineArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Register */}
      <div className="pt-2 text-center text-xs text-slate-600">
        New seller on Krozenda?{' '}
        <Link to="/seller/register" className="font-bold text-brand-600 hover:underline">
          Create an account
        </Link>
      </div>
    </VendorLoginShell>
  )
}

function ForgotPasswordFlow({ initialEmail, onDone, onCancel }) {
  const { requestReset, isSubmitting: isRequesting } = useVendorForgotPasswordController()
  const { resetPassword, isSubmitting: isResetting } = useVendorResetPasswordController()

  const [step, setStep] = useState('request')
  const [email, setEmail] = useState(initialEmail || '')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [devHint, setDevHint] = useState(null)

  async function handleRequest(e) {
    e.preventDefault()
    setError(null)
    try {
      const result = await requestReset({ email })
      setDevHint(result?.otp || null)
      toast.success('Reset code sent', 'Check your email for the 6-digit code.')
      setStep('reset')
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Could not send reset code')
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError(null)
    try {
      await resetPassword({ email, otp, newPassword, confirmPassword })
      toast.success('Password reset', 'Sign in with your new password.')
      onDone(email)
    } catch (err) {
      setError(err?.message || err?.response?.data?.message || 'Could not reset password')
    }
  }

  return (
    <div className="space-y-4">
      {step === 'request' ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Registered Email Address <span className="text-danger-500">*</span>
            </label>
            <div className="relative flex items-center">
              <HiOutlineEnvelope className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@example.com"
                required
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 placeholder:text-slate-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs transition-all outline-none font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRequesting}
              className="w-2/3 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs disabled:opacity-60"
            >
              {isRequesting ? 'Sending Code…' : 'Send Reset Code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          {devHint && (
            <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-xs flex items-center justify-between">
              <span>Demo OTP: <strong className="font-mono text-brand-900 font-bold">{devHint}</strong></span>
              <button
                type="button"
                onClick={() => setOtp(devHint)}
                className="text-xs font-bold text-brand-700 underline"
              >
                Auto-fill
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              6-Digit Code (OTP) <span className="text-danger-500">*</span>
            </label>
            <div className="relative flex items-center">
              <HiOutlineKey className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                required
                className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono font-bold outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password <span className="text-danger-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password <span className="text-danger-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs outline-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isResetting}
              className="w-2/3 bg-success-600 hover:bg-success-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors text-xs disabled:opacity-60"
            >
              {isResetting ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function PartnerDemoLoginPage() {
  const navigate = useNavigate()
  const registerPushToken = useVendorPushRegistration()
  const [email, setEmail] = useState('partner@krozenda.com')
  const [password, setPassword] = useState('password123')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function performLogin() {
    setIsSubmitting(true)
    setTimeout(() => {
      useAuthStore.getState().setSession({
        user: {
          name: 'Krozenda Supply Partner',
          email: 'partner@krozenda.com',
          storeName: 'Arya Manufacturing',
          entityType: 'Wholesale Manufacturer',
        },
        roles: ['dropshipping_partner'],
        permissions: ['dropshipping_partner.access', 'seller.access', 'vendor.access'],
        accessToken: `demo-vendor-partner-token-${Date.now()}`,
      })

      registerPushToken()
      toast.success('Authentication Successful', 'Welcome to Krozenda Dropshipping Partner Panel.')
      setIsSubmitting(false)
      navigate('/partner/dashboard')
    }, 400)
  }

  return (
    <VendorLoginShell
      title="Partner Portal Sign In"
      subtitle="For wholesale suppliers and dropshipping partners"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          performLogin()
        }}
        className="space-y-4 pt-1"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Partner Email Address <span className="text-danger-500">*</span>
          </label>
          <div className="relative flex items-center">
            <HiOutlineEnvelope className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 placeholder:text-slate-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs transition-all outline-none font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Password <span className="text-danger-500">*</span>
          </label>
          <div className="relative flex items-center">
            <HiOutlineLockClosed className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-50 text-slate-900 placeholder:text-slate-400 rounded-xl pl-10 pr-10 py-2.5 text-xs transition-all outline-none font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
            >
              {showPassword ? <HiEyeSlash className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all disabled:opacity-60 text-xs"
        >
          {isSubmitting ? 'Signing In…' : 'Sign In to Partner Portal'}
        </button>
      </form>
    </VendorLoginShell>
  )
}
