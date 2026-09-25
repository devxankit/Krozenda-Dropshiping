import { useEffect, useMemo } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../../lib/authStore'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { useAdminUiStore } from '../../stores/uiStore'
import { useShellController } from '../../controllers/useShellController'
import { useOwnStockController } from '../../controllers/useOwnStockController'
import { canAccessNavItem, findNavItem, visibleNavGroups } from '../../lib/nav'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'
import { CommandPalette } from './CommandPalette'
import { MobileNav } from './MobileNav'
import { NotificationsPanel } from './NotificationsPanel'


export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const permissions = useAuthStore((state) => state.permissions)
  const roles = useAuthStore((state) => state.roles)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const role = roles.includes('admin') ? 'admin' : roles[0] || null

  const sidebarCollapsed = useAdminUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar)
  const mobileNavOpen = useAdminUiStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useAdminUiStore((state) => state.setMobileNavOpen)
  const commandPaletteOpen = useAdminUiStore((state) => state.commandPaletteOpen)
  const setCommandPaletteOpen = useAdminUiStore((state) => state.setCommandPaletteOpen)
  const notificationsOpen = useAdminUiStore((state) => state.notificationsOpen)
  const setNotificationsOpen = useAdminUiStore((state) => state.setNotificationsOpen)

  const { counts, notifications, markAllRead } = useShellController()
  const groups = useMemo(() => visibleNavGroups(permissions, role), [permissions, role])

  // Read-only here: the sidebar greys the own-stock modules while it's off.
  // The switch itself lives on the dashboard (OwnStockCard).
  const ownStock = useOwnStockController()

  // Sidebar hiding is a UX nicety, not security — this is what actually
  // stops a staff account from opening a module by typing its URL directly.
  const currentNavItem = findNavItem(location.pathname)
  const isAuthorizedForRoute = canAccessNavItem(currentNavItem, permissions, role)

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setCommandPaletteOpen])

  function handleSignOut() {
    clearSession()
    navigate(ADMIN_ROUTES.LOGIN, { replace: true })
  }

  const firstAccessibleRoute = groups[0]?.items[0]?.to || null
  const isDashboardOrRoot =
    location.pathname === ADMIN_ROUTES.DASHBOARD || location.pathname === '/admin' || location.pathname === '/admin/'
  const unauthorizedRedirect =
    isDashboardOrRoot && firstAccessibleRoute ? firstAccessibleRoute : ADMIN_ROUTES.FORBIDDEN

  return (
    <div className="admin-root flex h-screen overflow-hidden bg-surface-muted print:h-auto print:overflow-visible print:bg-white">
      <div className="hidden lg:flex print:hidden">
        <AdminSidebar
          groups={groups}
          collapsed={sidebarCollapsed}
          counts={counts}
          ownStock={ownStock}
          onToggle={toggleSidebar}
          onSignOut={handleSignOut}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col print:w-full print:block">
        <div className="print:hidden">
          <AdminTopbar
            user={user}
            unreadCount={notifications.filter((item) => !item.read).length}
            onOpenSearch={() => setCommandPaletteOpen(true)}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onSignOut={handleSignOut}
          />
        </div>

        <main className="admin-scroll flex-1 overflow-y-auto print:overflow-visible print:h-auto print:p-0">
          {isAuthorizedForRoute ? (
            <Outlet />
          ) : (
            <Navigate to={unauthorizedRedirect} replace />
          )}
        </main>
      </div>

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        groups={groups}
        counts={counts}
      />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        permissions={permissions}
      />
      <NotificationsPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        items={notifications}
        onMarkAllRead={markAllRead}
      />

    </div>
  )
}
