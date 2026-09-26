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
      className={`min-w-0 rounded-lg border p-4 shadow-card transition-[box-shadow,border-color] duration-150 hover:shadow-raised ${emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface hover:border-border-strong'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`min-w-0 pt-1 text-2xs font-semibold uppercase leading-snug tracking-wider ${emphasised ? 'text-brand-600' : 'text-ink-subtle'}`}
        >
          {label}
        </p>
        {icon && (
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${emphasised ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-muted'}`}
          >
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      <p
        className={`tabular mt-2 text-2xl font-bold tracking-tight ${emphasised ? 'text-brand-700' : 'text-slate-900'}`}
      >
        {formatValue(value)}
      </p>
      {(delta || caption) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
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
          {caption && <span className="text-2xs text-ink-faint">{caption}</span>}
        </div>
      )}
    </div>
  )
}
