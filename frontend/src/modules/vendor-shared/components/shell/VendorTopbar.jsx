import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Icon } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'
import { toast } from '../../../admin/stores/toastStore'

export function VendorTopbar({ onOpenMobileNav, isPartner = false }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const storeName = user?.storeName || user?.name || 'Arya Manufacturing'
  const email = user?.email || (isPartner ? 'partner@krozenda.com' : 'seller@krozenda.com')
  const roleLabel = isPartner ? 'Dropshipping Partner' : 'Marketplace Seller'
  const basePath = isPartner ? '/partner' : '/seller'

  useEffect(() => {
    if (!menuOpen) return undefined
    function onPointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  const handleSignOut = () => {
    clearSession()
    toast.info('Signed Out', 'You have been signed out of your vendor portal.')
    navigate(isPartner ? '/partner/login' : '/seller/login')
  }

  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-muted lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {/* Global Quick Search Button */}
      <button
        type="button"
        onClick={() => toast.info('Quick Search', 'Use table search in Products or Orders page.')}
        className="flex h-8 w-full max-w-80 items-center gap-2 rounded-md border border-border bg-surface-muted px-2.5 text-left text-xs text-ink-faint transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="search" className="h-3.5 w-3.5" />
        <span className="truncate">Search orders, SKUs, AWBs, shipments…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 text-2xs font-medium text-ink-subtle sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex-1" />

      {/* Notifications Button */}
      <button
        type="button"
        onClick={() =>
          toast.info('Sub-Orders Pending', '6 assigned sub-orders waiting for packing & shipping label.')
        }
        aria-label="Notifications"
        className="relative rounded-md p-2 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="notifications" className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-surface bg-brand-500" />
      </button>

      <div className="h-6 w-px bg-border" />

      {/* User Avatar & Profile Dropdown */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Avatar name={storeName} size="sm" tone="inverted" />
          <span className="hidden leading-tight sm:block text-left">
            <span className="block text-xs font-semibold text-slate-900 truncate max-w-[140px]">
              {storeName}
            </span>
            <span className="block text-2xs text-ink-subtle">{roleLabel}</span>
          </span>
          <Icon name="chevronDown" className="h-3.5 w-3.5 text-ink-faint" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-dropdown mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-overlay">
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-slate-900">{storeName}</p>
              <p className="truncate text-xs text-ink-subtle">{email}</p>
            </div>

            <div className="p-1">
              <Link
                to={`${basePath}/kyc-documents`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-slate-900"
              >
                <Icon name="kyc" className="h-4 w-4 text-ink-faint" />
                KYC Verification
              </Link>
              <Link
                to={`${basePath}/settings`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-slate-900"
              >
                <Icon name="settings" className="h-4 w-4 text-ink-faint" />
                Store Settings
              </Link>
            </div>

            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  handleSignOut()
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-danger-700 transition-colors hover:bg-danger-50"
              >
                <Icon name="logout" className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
