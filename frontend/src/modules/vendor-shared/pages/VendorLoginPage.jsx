import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Input } from '../../../components/ui'
import { useAuthStore } from '../../../lib/authStore'
import { toast } from '../../admin/stores/toastStore'

export function VendorLoginPage({ mode = 'seller' }) {
  const navigate = useNavigate()
  const [activeMode, setActiveMode] = useState(mode)
  const [email, setEmail] = useState(
    activeMode === 'partner' ? 'partner@krozenda.com' : 'seller@krozenda.com',
  )
  const [password, setPassword] = useState('password123')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleModeSwitch = (newMode) => {
    setActiveMode(newMode)
    setEmail(newMode === 'partner' ? 'partner@krozenda.com' : 'seller@krozenda.com')
  }

  const performLogin = (targetMode) => {
    setIsSubmitting(true)
    const isPartner = targetMode === 'partner'

    setTimeout(() => {
      useAuthStore.getState().setSession({
        user: {
          name: isPartner ? 'Krozenda Supply Partner' : 'Ramesh Sharma',
          email: isPartner ? 'partner@krozenda.com' : 'seller@krozenda.com',
          storeName: 'Arya Manufacturing',
          entityType: isPartner ? 'Wholesale Manufacturer' : 'Registered Seller',
        },
        roles: isPartner ? ['dropshipping_partner'] : ['seller'],
        permissions: isPartner
          ? ['dropshipping_partner.access', 'seller.access', 'vendor.access']
          : ['seller.access', 'vendor.access'],
        accessToken: `demo-vendor-${targetMode}-token-` + Date.now(),
      })

      toast.success(
        'Authentication Successful',
        `Welcome to Krozenda ${isPartner ? 'Dropshipping Partner' : 'Seller'} Panel.`,
      )
      setIsSubmitting(false)
      navigate(isPartner ? '/partner/dashboard' : '/seller/dashboard')
    }, 400)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    performLogin(activeMode)
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-brand-900/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 font-bold text-white text-xl shadow-lg shadow-brand-600/30">
            K
          </div>
          <h1 className="mt-4 text-xl font-bold text-white tracking-tight">Krozenda Vendor Portal</h1>
          <p className="mt-1 text-xs text-slate-400">
            Unified Portal for Sellers & Dropshipping Supply Partners
          </p>
        </div>

        {/* Portal Mode Selector Tabs */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => handleModeSwitch('seller')}
            className={`py-2 text-xs font-semibold rounded-md transition-all ${
              activeMode === 'seller'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Seller Panel
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('partner')}
            className={`py-2 text-xs font-semibold rounded-md transition-all ${
              activeMode === 'partner'
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Partner Panel
          </button>
        </div>



        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            className="mt-2 w-full justify-center bg-brand-600 hover:bg-brand-500 text-white py-2.5 text-xs font-semibold rounded-lg shadow-md"
          >
            {isSubmitting
              ? 'Authenticating...'
              : `Sign In to ${activeMode === 'partner' ? 'Partner Panel' : 'Seller Panel'}`}
          </Button>
        </form>

        {/* One-Click Quick Demo Login Shortcuts */}
        <div className="mt-6 border-t border-slate-800/80 pt-4 flex flex-col gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400 text-center">
            One-Click Instant Access
          </span>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => performLogin('seller')}
              className="w-full text-2xs justify-center"
            >
              ⚡ Login as Seller
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => performLogin('partner')}
              className="w-full text-2xs justify-center"
            >
              ⚡ Login as Partner
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
