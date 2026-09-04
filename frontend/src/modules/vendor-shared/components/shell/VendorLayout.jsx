import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { VendorSidebar } from './VendorSidebar'
import { VendorTopbar } from './VendorTopbar'
import { ToastViewport } from '../../../admin/components/feedback'

export function VendorLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()

  const isPartner = pathname.startsWith('/partner')

  return (
    <div className="vendor-root flex h-screen overflow-hidden bg-surface-sunken">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex">
        <VendorSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          isPartner={isPartner}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <VendorTopbar onOpenMobileNav={() => setMobileOpen(true)} isPartner={isPartner} />

        <main className="admin-scroll flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-modal flex lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-surface">
            <VendorSidebar collapsed={false} onToggle={() => setMobileOpen(false)} isPartner={isPartner} />
          </div>
        </div>
      )}

      {/* Global Vendor Toast Viewport */}
      <ToastViewport />
    </div>
  )
}
