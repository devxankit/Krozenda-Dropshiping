import { Link } from 'react-router-dom'
import { Button, Icon } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { BarSeries, ChartFrame, DonutSplit, formatAxisRupees } from '../../components/charts'
import { KpiStrip } from '../../components/analytics/AnalyticsShell'
import { SectionCard, formatMoney } from '../../components/display'
import { useFinanceOverviewController } from '../../controllers/useFinanceController'

const CASH_SERIES = [
  { key: 'inflow', label: 'Collected' },
  { key: 'outflow', label: 'Paid out' },
]

const TONE_STYLES = Object.freeze({
  danger: 'bg-danger-50 text-danger-700',
  warning: 'bg-warning-50 text-warning-700',
  brand: 'bg-brand-50 text-brand-700',
})

export function FinanceOverviewPage() {
  const { data, isLoading, error, refetch } = useFinanceOverviewController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const held = data.holdBuckets.reduce((total, bucket) => total + bucket.value, 0)

  return (
    <PageBody>
      <PageHeader
        title="Finance overview"
        description="Money in, money held, money owed — and what is waiting on a decision."
        actions={
          <Button variant="secondary" size="control" icon="download">
            Export
          </Button>
        }
      />

      <KpiStrip kpis={data.kpis} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ChartFrame
          title="Collected against paid out"
          description="Buyer payments in, vendor settlements and refunds out"
          series={CASH_SERIES}
          height={280}
        >
          <BarSeries
            data={data.cashPosition}
            series={CASH_SERIES}
            formatAxis={formatAxisRupees}
            formatValue={(value) => formatMoney(value, { compact: true })}
          />
        </ChartFrame>

        <ChartFrame
          title="Held for settlement"
          description="By how close each bucket is to release"
          height={280}
        >
          <DonutSplit
            data={data.holdBuckets}
            formatValue={(value) => formatMoney(value, { compact: true })}
            centreValue={formatMoney(held, { compact: true })}
            centreLabel="in hold"
          />
        </ChartFrame>
      </div>

      <SectionCard
        title="Needs a decision"
        description="Nothing here moves on its own"
      >
        <ul className="divide-y divide-border-subtle">
          {data.attention.map((item) => (
            <li key={item.id}>
              <Link
                to={item.to}
                className="flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONE_STYLES[item.tone]}`}
                >
                  <Icon name={item.tone === 'brand' ? 'tax' : 'warning'} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900">
                    {item.title}
                  </span>
                  <span className="block truncate text-2xs text-ink-subtle">{item.detail}</span>
                </span>
                <span className="tabular shrink-0 text-sm font-bold text-slate-900">
                  {formatMoney(item.amount, { compact: true })}
                </span>
                <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageBody>
  )
}
