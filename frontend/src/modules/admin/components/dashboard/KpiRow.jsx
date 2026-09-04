import { Icon } from '../../../../components/ui'
import { formatMoney } from '../display'
import { SERIES, Sparkline } from '../charts'

const DELTA_TONE = Object.freeze({
  up: 'bg-success-50 text-success-700',
  down: 'bg-danger-50 text-danger-700',
  flat: 'bg-surface-muted text-ink-subtle',
})

function formatKpi(kpi) {
  if (kpi.format === 'money') return formatMoney(kpi.value, { compact: kpi.value >= 10000000 })
  return kpi.value.toLocaleString('en-IN')
}

// Big-number tiles lead the dashboard because these five figures ARE the
// page's answer. The sparkline shows shape only; the number carries the value.
export function KpiRow({ kpis = [] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi, index) => {
        const emphasised = kpi.tone === 'brand'
        return (
          <div
            key={kpi.key}
            className={`flex flex-col rounded-lg border p-4 ${emphasised ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface'}`}
          >
            <p
              className={`text-2xs font-semibold uppercase tracking-wider ${emphasised ? 'text-brand-600' : 'text-ink-faint'}`}
            >
              {kpi.label}
            </p>
            <p
              className={`tabular mt-2 text-xl font-bold tracking-tight ${emphasised ? 'text-brand-700' : 'text-slate-900'}`}
            >
              {formatKpi(kpi)}
            </p>

            <div className="mt-2 flex items-center gap-2">
              {kpi.delta && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold ${DELTA_TONE[kpi.delta.direction]}`}
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
              <span className="truncate text-2xs text-ink-faint">{kpi.caption}</span>
            </div>

            {kpi.trend && (
              <div className="-mx-1 mt-3">
                <Sparkline data={kpi.trend} color={SERIES[index % SERIES.length]} height={28} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
