import { Link } from 'react-router-dom'
import { Badge, Icon } from '../../../../components/ui'
import { SectionCard } from '../display'

const QUEUE_TONE = Object.freeze({
  brand: 'bg-brand-50 text-brand-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
})

// Work waiting on an admin, ordered by how much of it there is. The API sends
// only queues that actually have something in them, so an empty list here is
// the real "nothing to do" state rather than five rows of zeroes.
export function ActionQueue({ items = [] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)

  return (
    <SectionCard
      title="Needs your attention"
      actions={
        <Badge tone={total > 0 ? 'warning' : 'success'} dot>
          {total > 0 ? `${total.toLocaleString('en-IN')} open` : 'All clear'}
        </Badge>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Icon name="successCircle" className="h-6 w-6 text-success-500" />
          <p className="text-xs font-medium text-slate-900">Every queue is empty</p>
          <p className="text-2xs text-ink-faint">
            No KYC, returns, tickets or stock alerts are waiting on you.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="group flex items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-muted"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${QUEUE_TONE[item.tone]}`}
              >
                <Icon name={item.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-900">
                  {item.title}
                </span>
                <span className="block truncate text-2xs text-ink-subtle">{item.subtitle}</span>
              </span>
              <span className="tabular text-sm font-bold text-slate-900">
                {item.count.toLocaleString('en-IN')}
              </span>
              <Icon
                name="chevronRight"
                className="h-3.5 w-3.5 shrink-0 text-border-strong transition-colors group-hover:text-ink-subtle"
              />
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
