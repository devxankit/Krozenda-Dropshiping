import { Icon } from '../../../../components/ui'

// Layout primitives shared by every detail screen.

export function SectionCard({ title, description, actions, footer, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-surface shadow-card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </section>
  )
}

// items: [{ label, value }]
export function KeyValueList({ items = [], columns = 1, className = '' }) {
  return (
    <dl
      className={`grid gap-x-6 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex items-baseline justify-between gap-4 py-2 text-xs ${index >= columns ? 'border-t border-border-subtle' : ''}`}
        >
          <dt className="shrink-0 text-ink-subtle">{item.label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// events: [{ label, at, actor, reason, tone, done }]
export function Timeline({ events = [] }) {
  const TONE = { success: 'bg-success-500', danger: 'bg-danger-500', warning: 'bg-warning-500' }

  return (
    <ol className="flex flex-col">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        return (
          <li key={`${event.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${
                  event.done ? TONE[event.tone] || 'bg-brand-600' : 'bg-border-strong'
                }`}
              />
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <p className={`text-xs font-semibold ${event.done ? 'text-slate-900' : 'text-ink-faint'}`}>
                {event.label}
              </p>
              {event.at && (
                <p className="tabular mt-0.5 text-2xs text-ink-faint">
                  {event.at}
                  {event.actor && <span className="font-sans"> · {event.actor}</span>}
                </p>
              )}
              {event.reason && <p className="mt-1 text-2xs leading-snug text-ink-subtle">{event.reason}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// Business-model dot row — shows a parent order's vendor split at a glance.
export function ModelDots({ models = [], label }) {
  const COLOR = { marketplace: 'bg-chart-1', dropshipping: 'bg-chart-2', own_stock: 'bg-chart-3' }
  return (
    <span className="flex items-center gap-1.5">
      {models.map((model, index) => (
        <span
          key={`${model}-${index}`}
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR[model] || 'bg-border-strong'}`}
        />
      ))}
      {label && <span className="ml-1 truncate text-xs text-ink-muted">{label}</span>}
    </span>
  )
}

export function RowActions({ items = [] }) {
  return (
    <span className="flex items-center justify-end gap-1">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          title={item.label}
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Icon name={item.icon} className="h-3.5 w-3.5" />
        </button>
      ))}
    </span>
  )
}
