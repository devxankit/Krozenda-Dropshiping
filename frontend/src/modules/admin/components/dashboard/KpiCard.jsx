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

// Presentation only: KPI payloads carry a key and a format, not an icon, so
// the card picks one. An explicit `kpi.icon` always wins.
const KPI_ICON = Object.freeze({
  revenue: 'money',
  gmv: 'money',
  netSales: 'money',
  commission: 'percent',
  collected: 'money',
  payout: 'settlements',
  held: 'pause',
  orders: 'orders',
  pending: 'pending',
  aov: 'cart',
  basket: 'cart',
  units: 'inventory',
  sellers: 'sellers',
  products: 'products',
  live: 'live',
  refunds: 'returns',
  refundRate: 'returns',
  returnRate: 'returns',
  rto: 'truck',
  dispatch: 'truck',
  reviews: 'star',
  newBuyers: 'users',
  returningBuyers: 'users',
  repeat: 'users',
  sellThrough: 'trendUp',
  acceptance: 'successCircle',
})

const FORMAT_ICON = Object.freeze({ money: 'money', percent: 'percent' })

function kpiIcon(kpi) {
  return kpi.icon || KPI_ICON[kpi.key] || FORMAT_ICON[kpi.format] || 'activity'
}

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
      className={`relative flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border shadow-card transition-[box-shadow,border-color] duration-150 hover:shadow-raised ${
        emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface hover:border-border-strong'
      }`}
    >
      {emphasised && <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-brand-600" />}

      <div className="px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`min-w-0 pt-1 text-2xs font-semibold uppercase leading-snug tracking-wider ${
              emphasised ? 'text-brand-600' : 'text-ink-subtle'
            }`}
          >
            {kpi.label}
          </p>
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              emphasised ? 'bg-brand-600 text-white shadow-xs' : 'bg-surface-sunken text-ink-muted'
            }`}
          >
            <Icon name={kpiIcon(kpi)} className="h-4 w-4" />
          </span>
        </div>

        <p
          className={`tabular mt-1.5 text-2xl font-bold leading-tight tracking-tight ${
            emphasised ? 'text-brand-700' : 'text-slate-900'
          }`}
        >
          {formatKpiValue(kpi)}
        </p>

        <div className="mt-2 flex min-w-0 items-center gap-2">
          {kpi.delta && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold ${deltaTone(kpi.delta)}`}
            >
              {kpi.delta.direction !== 'flat' && (
                <Icon name={kpi.delta.direction === 'up' ? 'arrowUp' : 'arrowDown'} className="h-2.5 w-2.5" />
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
    <div className={`grid grid-cols-1 gap-4 ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[4]}`}>
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  )
}
