import { NavLink, useLocation } from 'react-router-dom'
import { Icon, Tooltip } from '../../../../components/ui'
import { getVendorNavTree, isVendorItemActive } from '../../lib/vendorNav'
import { useVendorOnboardingState } from '../../controllers/useVendorController'
import { VENDOR_ONBOARDING_ALLOWED } from '../../constants'
import {
  BrandMark,
  NavCount,
  NavGroupLabel,
  navIconClass,
  navItemClass,
} from '../../../admin/components/shell/navStyles'

function NavItem({ item, collapsed, locked = false, size, onNavigate }) {
  const { pathname } = useLocation()
  const active = isVendorItemActive(item, pathname)
  const count = item.badge

  // A locked item stays visible rather than disappearing: a seller waiting on
  // approval should be able to see what the panel will give them, and an item
  // that vanishes and reappears makes the nav feel broken. It is rendered as a
  // disabled control, not a link, so keyboard and screen-reader users get the
  // same answer as the pointer does.
  if (locked) {
    const body = (
      <span
        aria-disabled="true"
        className={`${navItemClass({ collapsed, size })} cursor-not-allowed !text-ink-faint hover:!bg-transparent`}
      >
        <Icon name={item.icon} className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-60" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && <Icon name="lock" className="ml-auto h-3 w-3 shrink-0" />}
      </span>
    )

    return (
      <Tooltip label={`${item.label} — available once your account is approved`} placement="right">
        <span className="relative">{body}</span>
      </Tooltip>
    )
  }

  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={navItemClass({ active, collapsed, size })}
    >
      <Icon name={item.icon} className={navIconClass(active)} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && count ? <NavCount count={count} tone={item.badgeTone} /> : null}
      {collapsed && count ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-surface bg-warning-500" />
      ) : null}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip label={count ? `${item.label} (${count})` : item.label} placement="right">
      <span className="relative">{link}</span>
    </Tooltip>
  )
}

// The collapse control rides in the header row rather than taking a row of
// its own: it belongs to the sidebar's chrome, not to the navigation. In the
// rail it is the only thing in that row — 64px cannot hold the wordmark and a
// control without both feeling cramped, and Dashboard is the first nav item
// directly below, so the way home is never more than one click away.
function CollapseToggle({ collapsed, onToggle, isDrawer = false }) {
  const label = isDrawer ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={isDrawer ? undefined : !collapsed}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${collapsed ? '' : 'ml-auto'}`}
    >
      <Icon name={isDrawer ? 'close' : collapsed ? 'chevronsRight' : 'chevronsLeft'} className="h-4 w-4" />
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

// variant: 'rail' (desktop, collapsible) | 'drawer' (mobile, full-width in
// its container, 40px touch rows, closes itself on navigation)
export function VendorSidebar({
  collapsed = false,
  onToggle,
  isPartner = false,
  onSignOut,
  onNavigate,
  variant = 'rail',
}) {
  const isDrawer = variant === 'drawer'
  const size = isDrawer ? 'touch' : 'desktop'
  const { isApproved } = useVendorOnboardingState()
  const groups = getVendorNavTree(isPartner, isApproved)

  // Mirrors VendorOnboardingGate's allow-list so the sidebar can never offer a
  // destination the router would bounce. Both read the same constant.
  const isLocked = (item) =>
    !isApproved && !VENDOR_ONBOARDING_ALLOWED.some((suffix) => item.to.endsWith(`/${suffix}`))

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-surface transition-[width] duration-150 ${
        isDrawer ? 'w-full' : `border-r border-border ${collapsed ? 'w-rail items-center' : 'w-sidebar'}`
      }`}
    >
      <div
        className={`flex h-topbar shrink-0 items-center gap-2.5 border-b border-border ${
          collapsed ? 'justify-center px-0' : 'px-4'
        }`}
      >
        {!collapsed && (
          <NavLink
            to={isPartner ? '/partner/dashboard' : '/seller/dashboard'}
            onClick={onNavigate}
            className="flex min-w-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Krozenda vendor home"
          >
            <BrandMark label={isPartner ? 'PARTNER' : 'SELLER'} />
          </NavLink>
        )}

        <CollapseToggle collapsed={collapsed} onToggle={onToggle} isDrawer={isDrawer} />
      </div>

      <nav
        aria-label="Seller navigation"
        className="admin-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto p-2.5"
      >
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                <div className="mx-auto my-2 h-px w-6 bg-border" />
              ) : (
                <NavGroupLabel>{group.label}</NavGroupLabel>
              ))}
            {group.items.map((item) => (
              <NavItem
                key={item.to}
                item={item}
                collapsed={collapsed}
                locked={isLocked(item)}
                size={size}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2.5">
        <SignOutButton collapsed={collapsed} onSignOut={onSignOut} />
      </div>
    </aside>
  )
}
