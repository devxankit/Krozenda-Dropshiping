import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Icon } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'
import { LanguageSwitcher } from '../../../../components/common/LanguageSwitcher'
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
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleSignOut = () => {
    clearSession()
    toast.info('Signed Out', 'You have been signed out of your vendor portal.')
    navigate(isPartner ? '/partner/login' : '/seller/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 lg:h-topbar shrink-0 items-center justify-between border-b border-border bg-white/95 px-3 backdrop-blur-md sm:px-5">
      {/* Mobile App Left Header: Drawer Toggle + Store Title */}
      <div className="flex items-center gap-1.5 lg:hidden min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <Icon name="menu" className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate text-xs font-bold text-slate-900 tracking-tight">
            {storeName}
          </span>
          <span className="inline-flex items-center text-brand-600 shrink-0">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>

      {/* Desktop Search Button */}
      <button
        type="button"
        onClick={() => toast.info('Quick Search', 'Use table search in Products or Orders page.')}
        aria-label="Search orders, SKUs, AWBs, shipments"
        className="hidden lg:flex h-9 w-80 shrink-0 items-center justify-start gap-2 rounded-lg border border-border bg-surface-muted px-3 text-left text-xs text-ink-faint hover:border-border-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="search" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Search orders, SKUs, AWBs, shipments…</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 text-2xs font-medium text-ink-subtle">
          ⌘K
        </kbd>
      </button>

      {/* Right Controls (Shared / Responsive) */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={() => toast.info('Quick Search', 'Use table search in Products or Orders page.')}
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all lg:hidden"
        >
          <Icon name="search" className="h-4 w-4" />
        </button>

        <LanguageSwitcher variant="compact" tone="panel" />

        {/* Notifications Button */}
        <button
          type="button"
          onClick={() =>
            toast.info('Sub-Orders Pending', '6 assigned sub-orders waiting for packing & shipping label.')
          }
          aria-label="Notifications"
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
        >
          <Icon name="notifications" className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-white bg-brand-500" />
        </button>

        <div className="hidden h-6 w-px bg-border sm:block" />

        {/* User Avatar & Profile Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-95"
          >
            <Avatar name={storeName} size="sm" tone="inverted" />
            <span className="hidden leading-tight sm:block text-left">
              <span className="block text-xs font-semibold text-slate-900 truncate max-w-[140px]">
                {storeName}
              </span>
              <span className="block text-2xs text-ink-subtle">{roleLabel}</span>
            </span>
            <Icon name="chevronDown" className="hidden h-3.5 w-3.5 text-ink-faint sm:block" />
          </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-dropdown mt-2 w-64 origin-top-right animate-scale-in overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
          >
            <div className="border-b border-border bg-surface-muted px-3.5 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">{storeName}</p>
              <p className="truncate text-xs text-ink-subtle">{email}</p>
            </div>

            <div className="p-1">
              <Link
                to={`${basePath}/kyc-documents`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:bg-surface-muted focus-visible:outline-none"
              >
                <Icon name="kyc" className="h-4 w-4 text-ink-faint" />
                KYC Verification
              </Link>
              <Link
                to={`${basePath}/settings`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:bg-surface-muted focus-visible:outline-none"
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
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-danger-700 transition-colors hover:bg-danger-50 focus-visible:bg-danger-50 focus-visible:outline-none"
              >
                <Icon name="logout" className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </header>
  )
}
