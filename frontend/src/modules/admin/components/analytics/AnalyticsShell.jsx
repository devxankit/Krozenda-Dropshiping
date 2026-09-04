import { useNavigate, useLocation } from 'react-router-dom'
import { Button, SegmentedControl, Tabs } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../shell'
import { ErrorState, PageSkeleton } from '../feedback'
import { DASHBOARD_RANGES } from '../../controllers/useDashboardController'
import { formatMoney } from '../display'
import { Icon } from '../../../../components/ui'

const TABS = Object.freeze([
  { id: ADMIN_ROUTES.ANALYTICS_SALES, label: 'Sales' },
  { id: ADMIN_ROUTES.ANALYTICS_VENDORS, label: 'Vendors' },
  { id: ADMIN_ROUTES.ANALYTICS_CATALOG, label: 'Catalog' },
  { id: ADMIN_ROUTES.ANALYTICS_CUSTOMERS, label: 'Customers' },
])

const DELTA_TONE = Object.freeze({
  up: 'bg-success-50 text-success-700',
  down: 'bg-danger-50 text-danger-700',
  flat: 'bg-surface-muted text-ink-subtle',
})

function formatKpi(kpi) {
  if (kpi.format === 'money') return formatMoney(kpi.value, { compact: kpi.value >= 10000000 })
  if (kpi.format === 'percent') return `${kpi.value}%`
  if (kpi.format === 'ratio') return kpi.value.toFixed(1)
  return kpi.value.toLocaleString('en-IN')
}

export function KpiStrip({ kpis = [] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            {kpi.label}
          </p>
          <p className="tabular mt-2 text-xl font-bold tracking-tight text-slate-900">
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
        </div>
      ))}
    </div>
  )
}

// The four analytics screens share a header, a tab strip, a range picker and
// all four states — so each page is only its own charts.
export function AnalyticsShell({ title, description, controller, children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { range, setRange, data, isLoading, error, refetch } = controller

  return (
    <PageBody>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />
            <Button variant="secondary" size="control" icon="download">
              Export
            </Button>
          </>
        }
      />

      <Tabs items={TABS} activeId={pathname} onChange={(id) => navigate(id)} />

      {isLoading && <PageSkeleton rows={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <>
          <KpiStrip kpis={data.kpis} />
          {children(data)}
        </>
      )}
    </PageBody>
  )
}
