import { NavLink, useLocation } from 'react-router-dom'
import { Icon, Tooltip } from '../../../../components/ui'
import { getVendorNavTree, isVendorItemActive } from '../../lib/vendorNav'

const BADGE_TONE = Object.freeze({
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  brand: 'bg-brand-100 text-brand-700',
})

function NavItem({ item, collapsed }) {
  const { pathname } = useLocation()
  const active = isVendorItemActive(item, pathname)
  const count = item.badge

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
      {!collapsed && count && (
        <span
          className={`ml-auto shrink-0 rounded-full px-1.5 text-2xs font-semibold ${
            BADGE_TONE[item.badgeTone] || BADGE_TONE.brand
          }`}
        >
          {count}
        </span>
      )}
      {collapsed && count && (
        <span className="absolute right-1 top-0.5 h-1.5 w-1.5 rounded-full bg-warning-500" />
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip label={count ? `${item.label} (${count})` : item.label} placement="right">
      <span className="relative">{link}</span>
    </Tooltip>
  )
}

export function VendorSidebar({ collapsed = false, onToggle, isPartner = false }) {
  const groups = getVendorNavTree(isPartner)

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 ${
        collapsed ? 'w-rail items-center' : 'w-sidebar'
      }`}
    >
      <div
        className={`flex h-topbar shrink-0 items-center gap-2.5 border-b border-border ${
          collapsed ? 'justify-center px-0' : 'px-4'
        }`}
      >
        <NavLink
          to={isPartner ? '/partner/dashboard' : '/seller/dashboard'}
          className="flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white"
          aria-label="Krozenda vendor home"
        >
          K
        </NavLink>
        {!collapsed && (
          <>
            <span className="text-sm font-bold tracking-tight text-slate-900">Krozenda</span>
            <span className="rounded-sm bg-surface-sunken px-1.5 py-0.5 text-2xs font-semibold tracking-wider text-ink-subtle">
              {isPartner ? 'PARTNER' : 'SELLER'}
            </span>
          </>
        )}
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
            {group.items.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            collapsed ? 'w-9 justify-center px-0' : 'w-full'
          }`}
        >
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} className="h-4 w-4 shrink-0" />
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}
