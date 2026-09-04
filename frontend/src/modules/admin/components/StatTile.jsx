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
export function StatTile({ label, value, delta, caption, tone = 'default' }) {
  const emphasised = tone === 'brand'

  return (
    <div
      className={`rounded-lg border p-4 ${emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface'}`}
    >
      <p
        className={`text-2xs font-semibold uppercase tracking-wider ${emphasised ? 'text-brand-600' : 'text-ink-faint'}`}
      >
        {label}
      </p>
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
                <Icon
                  name={delta.direction === 'up' ? 'arrowUp' : 'arrowDown'}
                  className="h-3 w-3"
                />
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
