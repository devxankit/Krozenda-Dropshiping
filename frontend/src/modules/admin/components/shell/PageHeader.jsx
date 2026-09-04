import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { findNavItem } from '../../lib/nav'

// Every screen's top block: breadcrumb, title, one line of context, actions.
// The breadcrumb's first two levels are derived from NAV_TREE so they cannot
// drift from the sidebar; a detail screen passes the last crumb itself.
export function PageHeader({ title, description, actions, trail = [], children }) {
  const { pathname } = useLocation()
  const navItem = findNavItem(pathname)

  const crumbs = [
    navItem?.group && { label: navItem.group },
    navItem && { label: navItem.label, to: navItem.to },
    ...trail,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-faint">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <Icon name="chevronRight" className="h-3 w-3" />}
                {crumb.to && !isLast ? (
                  <Link to={crumb.to} className="transition-colors hover:text-brand-700">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-ink-muted' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-xs text-ink-subtle">{description}</p>}
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
