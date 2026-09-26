import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon, Tooltip } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { isNavItemActive } from '../../lib/nav'
import { BrandMark, NavCount, NavGroupLabel, navIconClass, navItemClass } from './navStyles'

// `muted`: an own-stock module while the admin has "Own stock" switched off.
// It stays clickable (existing products can still be viewed and edited), it
// just reads as parked.
function NavItem({ item, collapsed, count, muted = false }) {
  const { pathname } = useLocation()
  const active = isNavItemActive(item, pathname)

  const link = (
    <NavLink
      to={item.to}
      aria-label={collapsed ? item.label : undefined}
      title={!collapsed ? item.description : undefined}
      className={navItemClass({ active, muted, collapsed })}
    >
      <Icon name={item.icon} className={navIconClass(active && !muted)} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && muted && (
        <span className="ml-auto shrink-0 rounded-sm bg-surface-sunken px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
          Off
        </span>
      )}
      {!collapsed && count > 0 && <NavCount count={count} tone={item.badgeTone} />}
      {collapsed && count > 0 && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-surface bg-warning-500" />
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip
      label={`${item.label}${count > 0 ? ` (${count})` : ''}${muted ? ' — own stock off' : ''}`}
      placement="right"
    >
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
    <NavItem key={item.to} item={item} collapsed={collapsed} count={item.badge ? counts[item.badge] : 0} />
  )

  if (collapsed) return items.map(renderItem)

  return (
    <>
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className={`${navItemClass()} w-full ${hasActive ? '!font-semibold !text-brand-700' : ''}`}
      >
        <Icon name={submenu.icon} className={navIconClass(hasActive)} />
        <span className="truncate">{submenu.label}</span>
        <Icon
          name="chevronDown"
          className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="ml-[1.1rem] flex animate-fade-in flex-col gap-0.5 border-l border-border pl-2">
          {items.map(renderItem)}
        </div>
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
      className={`flex h-9 items-center gap-3 rounded-md text-sm font-medium text-ink-muted transition-colors hover:bg-danger-50 hover:text-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${collapsed ? 'w-10 justify-center px-0' : 'w-full px-2.5'}`}
    >
      <Icon name="logout" className="h-[1.125rem] w-[1.125rem] shrink-0" />
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

// The "Own stock" group header only shows the state; the switch is on the
// dashboard (OwnStockCard).
function OwnStockHeader({ label, ownStock }) {
  const off = ownStock.isKnown && !ownStock.enabled
  return (
    <NavGroupLabel className={off ? '!text-ink-faint/70' : ''}>
      {label}
      {off && <span className="ml-1.5 normal-case tracking-normal text-warning-700">· off</span>}
    </NavGroupLabel>
  )
}

export function AdminSidebar({
  groups = [],
  collapsed = false,
  counts = {},
  ownStock = null,
  onToggle,
  onSignOut,
}) {
  const ownStockOff = Boolean(ownStock?.isKnown && !ownStock.enabled)

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
            className="flex min-w-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Krozenda admin home"
          >
            <BrandMark label="ADMIN" />
          </NavLink>
        )}

        <CollapseToggle collapsed={collapsed} onToggle={onToggle} />
      </div>

      <nav
        aria-label="Admin navigation"
        className="admin-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5"
      >
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto my-2 h-px w-6 bg-border" />
              ) : group.id === 'catalog' && ownStock ? (
                <OwnStockHeader label={group.label} ownStock={ownStock} />
              ) : (
                <NavGroupLabel>{group.label}</NavGroupLabel>
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
                  muted={ownStockOff && Boolean(item.ownStockModule)}
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
