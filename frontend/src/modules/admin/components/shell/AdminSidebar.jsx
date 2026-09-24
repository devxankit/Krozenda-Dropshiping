import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon, Tooltip } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { isNavItemActive } from '../../lib/nav'

const BADGE_TONE = Object.freeze({
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  brand: 'bg-brand-100 text-brand-700',
})

function NavItem({ item, collapsed, count }) {
  const { pathname } = useLocation()
  const active = isNavItemActive(item, pathname)

  const link = (
    <NavLink
      to={item.to}
      className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active
          ? 'bg-brand-50 font-semibold text-brand-700'
          : 'font-medium text-ink-muted hover:bg-surface-muted hover:text-slate-900'
      } ${collapsed ? 'w-9 justify-center px-0' : ''}`}
    >
      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && count > 0 && (
        <span
          className={`ml-auto shrink-0 rounded-full px-1.5 text-2xs font-semibold ${BADGE_TONE[item.badgeTone] || BADGE_TONE.brand}`}
        >
          {count}
        </span>
      )}
      {collapsed && count > 0 && (
        <span className="absolute right-1 top-0.5 h-1.5 w-1.5 rounded-full bg-warning-500" />
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip label={count > 0 ? `${item.label} (${count})` : item.label} placement="right">
      <span className="relative">{link}</span>
    </Tooltip>
  )
}

// A group with `submenu` renders its items under one collapsible parent row
// (Dropshipping → CJ Dropshipping → Dashboard, Products…). It opens itself
// whenever one of its screens is active. In the 64px rail there is no room
// for nesting, so the items render flat there as before.
function NavSubmenu({ submenu, items, collapsed, counts }) {
  const { pathname } = useLocation()
  const hasActive = items.some((item) => isNavItemActive(item, pathname))
  // null until the admin toggles it — until then it follows the active route.
  const [toggled, setToggled] = useState(null)
  const open = toggled ?? hasActive

  const renderItem = (item) => (
    <NavItem
      key={item.to}
      item={item}
      collapsed={collapsed}
      count={item.badge ? counts[item.badge] : 0}
    />
  )

  if (collapsed) return items.map(renderItem)

  return (
    <>
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          hasActive ? 'font-semibold text-brand-700' : 'font-medium text-ink-muted hover:text-slate-900'
        }`}
      >
        <Icon name={submenu.icon} className="h-4 w-4 shrink-0" />
        <span className="truncate">{submenu.label}</span>
        <Icon
          name="chevronDown"
          className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">{items.map(renderItem)}</div>
      )}
    </>
  )
}

// The collapse control rides in the header row rather than taking a row of its
// own: it belongs to the sidebar's chrome, not to the navigation. In the rail
// it is the only thing in that row — 64px cannot hold the wordmark and a
// control without both feeling cramped, and Dashboard is the first nav item
// directly below, so the way home is never more than one click away.
function CollapseToggle({ collapsed, onToggle }) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${collapsed ? '' : 'ml-auto'}`}
    >
      <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} className="h-4 w-4" />
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip label={label} placement="right">
      {button}
    </Tooltip>
  )
}

function SignOutButton({ collapsed, onSignOut }) {
  const button = (
    <button
      type="button"
      onClick={onSignOut}
      aria-label="Log out"
      className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-danger-700 transition-colors hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${collapsed ? 'w-9 justify-center px-0' : 'w-full'}`}
    >
      <Icon name="logout" className="h-4 w-4 shrink-0" />
      {!collapsed && 'Logout'}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip label="Log out" placement="right">
      {button}
    </Tooltip>
  )
}

export function AdminSidebar({ groups = [], collapsed = false, counts = {}, onToggle, onSignOut }) {
  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 ${collapsed ? 'w-rail items-center' : 'w-sidebar'}`}
    >
      <div
        className={`flex h-topbar shrink-0 items-center gap-2.5 border-b border-border ${collapsed ? 'justify-center px-0' : 'px-4'}`}
      >
        {!collapsed && (
          <NavLink
            to={ADMIN_ROUTES.DASHBOARD}
            className="flex min-w-0 items-center gap-2.5 cursor-pointer"
            aria-label="Krozenda admin home"
          >
            <span className="flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white">
              K
            </span>
            <span className="text-sm font-bold tracking-tight text-slate-900">Krozenda</span>
            <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-2xs font-semibold tracking-wider text-ink-subtle">
              ADMIN
            </span>
          </NavLink>
        )}

        <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
      </div>

      <nav className="admin-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto my-2 h-px w-6 bg-border" />
              ) : (
                <p className="px-2 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                  {group.label}
                </p>
              ))}
            {group.submenu ? (
              <NavSubmenu submenu={group.submenu} items={group.items} collapsed={collapsed} counts={counts} />
            ) : (
              group.items.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  count={item.badge ? counts[item.badge] : 0}
                />
              ))
            )}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5">
        <SignOutButton collapsed={collapsed} onSignOut={onSignOut} />
      </div>
    </aside>
  )
}
