import { Icon } from '../../../components/ui'

const DELTA_TONE = Object.freeze({
  up: 'bg-success-50 text-success-700',
  down: 'bg-danger-50 text-danger-700',
  flat: 'bg-surface-muted text-ink-subtle',
})

function formatValue(value) {
  return typeof value === 'number' ? value.toLocaleString('en-IN') : value
}

// delta: { direction: 'up' | 'down' | 'flat', label: '12.4%' }
// icon: optional Icon name, shown in a tile opposite the label
export function StatTile({ label, value, delta, caption, tone = 'default', icon }) {
  const emphasised = tone === 'brand'

  return (
    <div
      className={`min-w-0 rounded-xl border p-3 sm:p-4 shadow-xs transition-[box-shadow,border-color] duration-150 hover:shadow-md ${emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface hover:border-border-strong'}`}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p
          className={`min-w-0 pt-0.5 text-[10px] sm:text-2xs font-semibold uppercase leading-snug tracking-wider ${emphasised ? 'text-brand-600' : 'text-ink-subtle'}`}
        >
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg ${emphasised ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-muted'}`}
          >
            <Icon name={icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        )}
      </div>
      <p
        className={`tabular mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight ${emphasised ? 'text-brand-700' : 'text-slate-900'}`}
      >
        {formatValue(value)}
      </p>
      {(delta || caption) && (
        <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
          {delta && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${DELTA_TONE[delta.direction]}`}
            >
              {delta.direction !== 'flat' && (
                <Icon name={delta.direction === 'up' ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />
              )}
              {delta.label}
            </span>
          )}
          {caption && <span className="text-[10px] sm:text-2xs text-ink-faint line-clamp-1 sm:line-clamp-none">{caption}</span>}
        </div>
      )}
    </div>
  )
}
