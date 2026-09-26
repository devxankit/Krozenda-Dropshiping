import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { VendorSidebar } from './VendorSidebar'
import { VendorTopbar } from './VendorTopbar'

import { useAuthStore } from '../../../../lib/authStore'
import { disconnectRealtime } from '../../../../lib/realtime'
import { useVendorPushRefresh, useVendorRealtime } from '../../controllers/useVendorController'
import { toast } from '../../../admin/stores/toastStore'

export function VendorLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)

  // One websocket for the whole panel, opened here because this is the only
  // component guaranteed to be mounted for as long as the seller is signed in.
  useVendorRealtime()
  useVendorPushRefresh()

  const isPartner = pathname.startsWith('/partner')

  // The mobile drawer behaves like every other overlay in the panel: Escape
  // closes it and the page behind does not scroll while it is open.
  useEffect(() => {
    if (!mobileOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  const handleSignOut = () => {
    // Before clearing the session: the socket is authenticated with the token
    // that is about to be thrown away, and a live connection outliving the
    // session is exactly the kind of thing that leaks one seller's events
    // into the next sign-in on a shared machine.
    disconnectRealtime()
    clearSession()
    toast.info('Signed Out', 'You have been signed out of your vendor portal.')
    navigate(isPartner ? '/partner/login' : '/seller/login')
  }

  return (
    <div className="vendor-root flex h-screen overflow-hidden bg-surface-muted print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex print:hidden">
        <VendorSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          isPartner={isPartner}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Main Content Area. No padding here: every screen renders inside
          PageBody, which owns the gutter — padding it here as well used to
          double it on every seller page. */}
      <div className="flex min-w-0 flex-1 flex-col print:block print:w-full">
        <div className="print:hidden">
          <VendorTopbar onOpenMobileNav={() => setMobileOpen(true)} isPartner={isPartner} />
        </div>

        <main className="admin-scroll flex-1 overflow-y-auto print:h-auto print:overflow-visible">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-drawer flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="fixed inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-[85vw] max-w-[18rem] animate-slide-in-left flex-col bg-surface shadow-overlay">
            <VendorSidebar
              variant="drawer"
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              isPartner={isPartner}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}
    </div>
  )
}
