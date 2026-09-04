import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'

const MENU_ITEMS = Object.freeze([
  { label: 'My profile', to: ADMIN_ROUTES.PROFILE, icon: 'user' },
  { label: 'Security', to: ADMIN_ROUTES.SETTINGS_SECURITY, icon: 'lock' },
  { label: 'Audit log', to: ADMIN_ROUTES.AUDIT_LOGS, icon: 'audit' },
])

export function ProfileMenu({ user, onSignOut, children }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-ink-subtle">{user?.email}</p>
          </div>

          <div className="p-1">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-slate-900"
              >
                <Icon name={item.icon} className="h-4 w-4 text-ink-faint" />
                {item.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-border p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignOut?.()
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
  )
}
