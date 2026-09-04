import { useEffect, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../../lib/authStore'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { useAdminUiStore } from '../../stores/uiStore'
import { useShellController } from '../../controllers/useShellController'
import { visibleNavGroups } from '../../lib/nav'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'
import { CommandPalette } from './CommandPalette'
import { MobileNav } from './MobileNav'
import { NotificationsPanel } from './NotificationsPanel'
import { ToastViewport } from '../feedback'

export function AdminLayout() {
  const navigate = useNavigate()
  const permissions = useAuthStore((state) => state.permissions)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)

  const sidebarCollapsed = useAdminUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAdminUiStore((state) => state.toggleSidebar)
  const mobileNavOpen = useAdminUiStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useAdminUiStore((state) => state.setMobileNavOpen)
  const commandPaletteOpen = useAdminUiStore((state) => state.commandPaletteOpen)
  const setCommandPaletteOpen = useAdminUiStore((state) => state.setCommandPaletteOpen)
  const notificationsOpen = useAdminUiStore((state) => state.notificationsOpen)
  const setNotificationsOpen = useAdminUiStore((state) => state.setNotificationsOpen)

  const { counts, notifications, markAllRead } = useShellController()
  const groups = useMemo(() => visibleNavGroups(permissions), [permissions])

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

  return (
    <div className="admin-root flex h-screen overflow-hidden">
      <div className="hidden lg:flex">
        <AdminSidebar
          groups={groups}
          collapsed={sidebarCollapsed}
          counts={counts}
          onToggle={toggleSidebar}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          user={user}
          unreadCount={notifications.filter((item) => !item.read).length}
          onOpenSearch={() => setCommandPaletteOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onSignOut={handleSignOut}
        />

        <main className="admin-scroll flex-1 overflow-y-auto">
          <Outlet />
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
      {/* Mounted once for the whole panel — every write reports through it. */}
      <ToastViewport />
    </div>
  )
}
