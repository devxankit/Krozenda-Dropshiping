// items: [{ id, label, count?, tone? }]
// Controlled. The active tab usually belongs in the URL, so this component
// reports the change rather than holding it.

export function Tabs({ items = [], activeId, onChange, className = '' }) {
  return (
    <div
      role="tablist"
      className={`no-scrollbar flex items-center gap-1.5 sm:gap-6 overflow-x-auto overflow-y-hidden border-b border-border pb-1 sm:pb-0 ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(item.id)}
            className={`flex h-7.5 sm:h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg sm:rounded-none sm:-mb-px sm:border-b-2 px-2.5 sm:px-0 text-xs sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
              isActive
                ? 'bg-brand-50 sm:bg-transparent border border-brand-200/80 sm:border-0 sm:border-b-2 sm:border-brand-600 font-bold text-brand-700 sm:text-slate-900 shadow-xs sm:shadow-none'
                : 'border border-transparent font-medium text-slate-500 hover:text-slate-800'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// The pill variant, for switching a view mode rather than a data set —
// a different job, so a different shape.
export function SegmentedControl({ items = [], activeId, onChange, className = '' }) {
  return (
    <div
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-surface-sunken p-1 no-scrollbar ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange?.(item.id)}
            className={`h-7 whitespace-nowrap rounded px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isActive
                ? 'bg-surface font-semibold text-slate-900 shadow-raised'
                : 'font-medium text-ink-subtle hover:text-slate-700'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
