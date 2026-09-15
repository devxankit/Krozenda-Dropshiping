import { Icon } from '../../../../components/ui'
import { formatMoney } from '../display'
import { SERIES, SparkArea } from '../charts'

// One KPI tile, shared by the dashboard and all four analytics screens, so a
// headline number looks and behaves the same wherever it is read.
//
// Colour rule: the arrow follows the MOVEMENT (up/down), the colour follows
// the SENTIMENT the API sends with it. A refund rate climbing is an up arrow
// in red; the same rate falling is a down arrow in green. Payloads without a
// sentiment fall back to "up is good", which is how the older fixtures read.

const DELTA_TONE = Object.freeze({
  positive: 'bg-success-50 text-success-700',
  negative: 'bg-danger-50 text-danger-700',
  neutral: 'bg-surface-muted text-ink-subtle',
})

const COLUMN_CLASSES = Object.freeze({
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
  5: 'sm:grid-cols-2 xl:grid-cols-5',
})

function deltaTone(delta) {
  if (delta.sentiment) return DELTA_TONE[delta.sentiment]
  if (delta.direction === 'flat') return DELTA_TONE.neutral
  return delta.direction === 'up' ? DELTA_TONE.positive : DELTA_TONE.negative
}

function formatKpiValue(kpi) {
  if (kpi.format === 'money') return formatMoney(kpi.value, { compact: kpi.value >= 10000000 })
  if (kpi.format === 'percent') return `${kpi.value}%`
  if (kpi.format === 'ratio') return kpi.value.toFixed(1)
  return kpi.value.toLocaleString('en-IN')
}

export function KpiCard({ kpi }) {
  const emphasised = kpi.tone === 'brand'
  const trend = kpi.trend?.length > 1 ? kpi.trend : null

  return (
    <article
      className={`relative flex flex-col justify-between overflow-hidden rounded-lg border shadow-card transition-shadow duration-150 hover:shadow-raised ${
        emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface'
      }`}
    >
      {emphasised && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand-600" />}

      <div className="px-4 pb-3 pt-4">
        <p
          className={`text-2xs font-semibold uppercase tracking-wider ${
            emphasised ? 'text-brand-600' : 'text-ink-faint'
          }`}
        >
          {kpi.label}
        </p>

        <p
          className={`tabular mt-1.5 text-2xl font-bold leading-tight tracking-tight ${
            emphasised ? 'text-brand-700' : 'text-slate-900'
          }`}
        >
          {formatKpiValue(kpi)}
        </p>

        <div className="mt-2 flex items-center gap-2">
          {kpi.delta && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold ${deltaTone(kpi.delta)}`}
            >
              {kpi.delta.direction !== 'flat' && (
                <Icon
                  name={kpi.delta.direction === 'up' ? 'arrowUp' : 'arrowDown'}
                  className="h-2.5 w-2.5"
                />
              )}
              {kpi.delta.label}
            </span>
          )}
          <span className="truncate text-2xs text-ink-faint" title={kpi.caption}>
            {kpi.caption}
          </span>
        </div>
      </div>

      {/* Flush along the bottom edge: the shape is context for the number
          above it, not a chart in its own right. */}
      {trend && <SparkArea data={trend} color={SERIES[0]} height={40} />}
    </article>
  )
}

export function KpiGrid({ kpis = [], columns = 4 }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[4]}`}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  )
}
