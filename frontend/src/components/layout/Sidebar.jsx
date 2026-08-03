import { NavLink } from 'react-router-dom'
import { Icon } from '../ui/Icon'

// items: [{ to, label, icon? }]
export function Sidebar({ items = [], header }) {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface">
      {header && <div className="px-4 py-5">{header}</div>}
      <nav className="flex-1 space-y-1 px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-surface-muted'
              }`
            }
          >
            {item.icon && <Icon name={item.icon} className="h-4 w-4" />}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
