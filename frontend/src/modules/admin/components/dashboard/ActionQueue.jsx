import { Link } from 'react-router-dom'
import { Badge, Icon } from '../../../../components/ui'
import { SectionCard } from '../display'

const QUEUE_TONE = Object.freeze({
  brand: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
})

export function ActionQueue({ items = [] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <SectionCard
      title="Needs your attention"
      actions={<Badge tone="warning">{total} open</Badge>}
    >
      <div className="flex flex-col">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-muted"
          >
            <span
              className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-md ${QUEUE_TONE[item.tone]}`}
              style={{ height: '1.875rem', width: '1.875rem' }}
            >
              <Icon name={item.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-900">
                {item.title}
              </span>
              <span className="block truncate text-2xs text-ink-subtle">{item.subtitle}</span>
            </span>
            <span className="tabular text-sm font-bold text-slate-900">{item.count}</span>
            <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}
