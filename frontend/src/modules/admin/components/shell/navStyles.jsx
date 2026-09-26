// Navigation look shared by AdminSidebar, MobileNav and the seller/partner
// VendorSidebar. They used to carry three hand-copied class strings; the two
// panels have different menus but must read as one product.

export const NAV_BADGE_TONE = Object.freeze({
  warning: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-700/20',
  danger: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-700/15',
  brand: 'bg-brand-100 text-brand-700',
})

// The active row gets a 3px bar on the sidebar's inner edge as well as the
// tint, so "where am I" survives a glance even in a long, scrolled menu.
const ACTIVE_BAR =
  "before:absolute before:-left-2.5 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-brand-600 before:content-['']"

// size: 'desktop' (36px rows) | 'touch' (40px rows, for the mobile drawer)
export function navItemClass({ active = false, muted = false, collapsed = false, size = 'desktop' } = {}) {
  const height = size === 'touch' ? 'h-10' : 'h-9'
  const layout = collapsed ? 'w-10 justify-center px-0' : 'px-2.5'

  let state
  if (active && muted) state = 'bg-surface-sunken font-semibold text-ink-subtle'
  else if (active) state = `bg-brand-50 font-semibold text-brand-700 ${collapsed ? '' : ACTIVE_BAR}`
  else if (muted) state = 'font-medium text-ink-faint opacity-70 hover:bg-surface-muted hover:opacity-100'
  else state = 'font-medium text-ink-muted hover:bg-surface-muted hover:text-slate-900'

  return `group relative flex ${height} items-center gap-3 rounded-md text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${layout} ${state}`
}

export function navIconClass(active) {
  return `h-[1.125rem] w-[1.125rem] shrink-0 transition-colors ${
    active ? 'text-brand-600' : 'text-ink-faint group-hover:text-ink-muted'
  }`
}

export function NavCount({ count, tone }) {
  return (
    <span
      className={`tabular ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-2xs font-semibold ${
        NAV_BADGE_TONE[tone] || NAV_BADGE_TONE.brand
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function NavGroupLabel({ children, className = '' }) {
  return (
    <p
      className={`px-2.5 pb-1.5 pt-4 text-2xs font-semibold uppercase tracking-wider text-ink-faint ${className}`}
    >
      {children}
    </p>
  )
}

// Wordmark used in both sidebars and the mobile drawer header.
export function BrandMark({ label }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-xs ring-1 ring-inset ring-white/10">
        K
      </span>
      <span className="text-[0.9375rem] font-bold tracking-tight text-slate-900">Krozenda</span>
      {label && (
        <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider text-ink-subtle">
          {label}
        </span>
      )}
    </span>
  )
}
