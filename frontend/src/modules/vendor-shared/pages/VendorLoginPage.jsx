import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HiOutlineShieldCheck, HiOutlineTruck } from 'react-icons/hi2'
import { Button, Input, PasswordInput } from '../../../components/ui'
import { VendorAuthShell as VendorLoginShell } from '../components/shell/VendorAuthShell'
import { useAuthStore } from '../../../lib/authStore'
import { toast } from '../../admin/stores/toastStore'
import {
  useVendorForgotPasswordController,
  useVendorLoginController,
  useVendorPushRegistration,
  useVendorResetPasswordController,
} from '../controllers/useVendorController'

// Seeded by backend/Router/seedVendors.js on boot (dev/staging only) so this
// screen always has real, working credentials to demo both vendor types
// against the actual login endpoint — not a fabricated session.
const DEMO_CREDENTIALS = {
  B2C: { email: 'b2c.demo@krozenda.com', password: 'Demo@1234', label: 'B2C · Individual seller' },
  B2B: { email: 'b2b.demo@krozenda.com', password: 'Demo@1234', label: 'B2B · Registered business' },
}

export function VendorLoginPage({ mode = 'seller' }) {
  if (mode === 'partner') return <PartnerDemoLoginPage />
  return <SellerLoginPage />
}

// Real login against POST /vendor/auth/login. The vendor's actual type
// (Vendor.vendorType, B2B or B2C) picks which demo account is prefilled —
// this is the platform's real seller-type distinction, unlike the seller-vs-
// partner split below which has no backend model behind it.
function SellerLoginPage() {
  const navigate = useNavigate()
  const registerPushToken = useVendorPushRegistration()
  const { login, isSubmitting } = useVendorLoginController()
  const [vendorType, setVendorType] = useState('B2C')
  const [email, setEmail] = useState(DEMO_CREDENTIALS.B2C.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.B2C.password)
  const [error, setError] = useState(null)
  const [view, setView] = useState('login') // 'login' | 'forgot'

  function handleTypeSwitch(nextType) {
    setVendorType(nextType)
    setEmail(DEMO_CREDENTIALS[nextType].email)
    setPassword(DEMO_CREDENTIALS[nextType].password)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

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
      const message = err?.response?.data?.message || 'Invalid email or password'
      setError(message)
      toast.error('Sign in failed', message)
    }
  }

  if (view === 'forgot') {
    return (
      <VendorLoginShell title="Reset your password" subtitle="We'll send a reset code to your email">
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
    <VendorLoginShell title="Krozenda Seller Portal" subtitle="For B2B businesses and B2C individual sellers">
      <div className="mt-7 grid grid-cols-2 gap-1 rounded-xl bg-slate-950/80 p-1 border border-slate-800">
        {['B2C', 'B2B'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeSwitch(type)}
            className={`py-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${
              vendorType === type
                ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {type} Seller
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-center text-2xs font-medium text-slate-500">{DEMO_CREDENTIALS[vendorType].label}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <PasswordInput
            id="vendor-login-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setView('forgot')}
            className="mt-1.5 text-2xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2.5 text-2xs font-medium text-danger-300">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
          className="mt-2 w-full justify-center bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-brand-600/25 transition-all duration-200 hover:shadow-brand-600/40 disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : `Sign In as ${vendorType}`}
        </Button>
      </form>

      <p className="mt-5 text-center text-2xs text-slate-400">
        New to Krozenda?{' '}
        <Link to="/seller/register" className="font-semibold text-brand-400 transition-colors hover:text-brand-300">
          Create a seller account
        </Link>
      </p>

      <div className="mt-6 flex items-center justify-center gap-4 border-t border-slate-800/80 pt-4 text-2xs font-medium text-slate-500">
        <span className="inline-flex items-center gap-1">
          <HiOutlineShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Escrow protected
        </span>
        <span className="inline-flex items-center gap-1">
          <HiOutlineTruck className="h-3.5 w-3.5 text-brand-400" /> Pan-India logistics
        </span>
      </div>
      <p className="mt-3 text-center text-2xs text-slate-500">
        Demo credentials are pre-filled — switch the tab above to try the other seller type.
      </p>
    </VendorLoginShell>
  )
}

// Two-step forgot-password flow against the real endpoints: request a code
// (POST /vendor/auth/forgot-password), then submit it with a new password
// (POST /vendor/auth/reset-password). No email gateway is wired up yet, so
// dev/staging echoes the code back in the response — same convention as the
// buyer app's mobile OTP (see requestOtp in userAuthController.js) — and
// this screen surfaces it directly so the flow is testable end to end.
function ForgotPasswordFlow({ initialEmail, onDone, onCancel }) {
  const { requestReset, isSubmitting: isRequesting } = useVendorForgotPasswordController()
  const { resetPassword, isSubmitting: isResetting } = useVendorResetPasswordController()

  const [step, setStep] = useState('request') // 'request' | 'reset'
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
      setError(err?.response?.data?.message || 'Could not send reset code')
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
      setError(err?.response?.data?.message || 'Could not reset password')
    }
  }

  if (step === 'request') {
    return (
      <form onSubmit={handleRequest} className="mt-6 flex flex-col gap-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />

        {error && (
          <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2.5 text-2xs font-medium text-danger-300">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isRequesting}
          className="mt-1 w-full justify-center bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-brand-600/25 transition-all duration-200 disabled:opacity-60"
        >
          {isRequesting ? 'Sending…' : 'Send reset code'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-center text-2xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          Back to sign in
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleReset} className="mt-6 flex flex-col gap-4">
      {devHint && (
        <p className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2.5 text-2xs text-brand-300">
          No email gateway is configured yet — dev reset code:{' '}
          <span className="font-bold tabular-nums">{devHint}</span>
        </p>
      )}

      <Input
        label="Reset code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="6-digit code"
        maxLength={6}
        required
        autoFocus
      />
      <PasswordInput
        id="vendor-reset-new-password"
        label="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      <PasswordInput
        id="vendor-reset-confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      {error && (
        <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2.5 text-2xs font-medium text-danger-300">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={isResetting}
        className="mt-1 w-full justify-center bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-brand-600/25 transition-all duration-200 disabled:opacity-60"
      >
        {isResetting ? 'Resetting…' : 'Reset password'}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="text-center text-2xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        Back to sign in
      </button>
    </form>
  )
}

// The dropshipping-partner login (/partner/login) has no backend model of
// its own — Vendor only knows B2B/B2C — so it stays a client-side demo
// session. Untouched: this file previously covered both modes with the same
// fake flow; splitting it out kept that behaviour identical.
function PartnerDemoLoginPage() {
  const navigate = useNavigate()
  const registerPushToken = useVendorPushRegistration()
  const [email, setEmail] = useState('partner@krozenda.com')
  const [password, setPassword] = useState('password123')
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
    <VendorLoginShell title="Krozenda Partner Portal" subtitle="For dropshipping supply partners">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          performLogin()
        }}
        className="mt-6 flex flex-col gap-4"
      >
        <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordInput
          id="partner-login-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
          className="mt-2 w-full justify-center bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white py-3 text-xs font-bold rounded-xl shadow-lg shadow-brand-600/25 transition-all duration-200 disabled:opacity-60"
        >
          {isSubmitting ? 'Authenticating...' : 'Sign In to Partner Panel'}
        </Button>
      </form>
    </VendorLoginShell>
  )
}

