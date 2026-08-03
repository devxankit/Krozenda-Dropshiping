import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'

// items: [{ label, to? }] — last item renders as plain text (current page)
export function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center">
            {index > 0 && <Icon name="chevronRight" className="mx-1 h-3.5 w-3.5 text-slate-400" />}
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-brand-700">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-slate-900' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
