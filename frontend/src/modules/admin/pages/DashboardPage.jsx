import { Button, SegmentedControl } from '../../../components/ui'
import { BUSINESS_MODEL, BUSINESS_MODEL_LABELS } from '../../../config/constants'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PageBody, PageHeader } from '../components/shell'
import { ErrorState, PageSkeleton } from '../components/feedback'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../components/charts'
import { formatMoney } from '../components/display'
import { KpiRow } from '../components/dashboard/KpiRow'
import {
  ActionQueue,
  IntegrationHealthStrip,
  OrderPipeline,
  RecentSubOrders,
} from '../components/dashboard'
import { DASHBOARD_RANGES, useDashboardController } from '../controllers/useDashboardController'

// Fixed series order — a model keeps its colour no matter how many are shown.
const REVENUE_SERIES = [
  { key: BUSINESS_MODEL.MARKETPLACE, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.MARKETPLACE] },
  { key: BUSINESS_MODEL.DROPSHIPPING, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.DROPSHIPPING] },
  { key: BUSINESS_MODEL.OWN_STOCK, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.OWN_STOCK] },
]

export function DashboardPage() {
  const { range, setRange, data, isLoading, isError, error, refetch } = useDashboardController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }

  if (isError) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="Dashboard"
        description="Marketplace, dropshipping and own stock — one view across all three."
        actions={
          <>
            <SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />
            <Button variant="secondary" size="control" icon="download">
              Export
            </Button>
          </>
        }
      />

      <IntegrationHealthStrip
        integrations={data.integrations}
        to={ADMIN_ROUTES.SETTINGS_INTEGRATIONS}
      />

      <KpiRow kpis={data.kpis} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ChartFrame
          title="Revenue by business model"
          description="Monthly gross merchandise value"
          series={REVENUE_SERIES}
          height={280}
        >
          <AreaTrend
            data={data.revenueByModel}
            series={REVENUE_SERIES}
            formatAxis={formatAxisRupees}
            formatValue={(value) => formatMoney(value, { compact: true })}
          />
        </ChartFrame>

        <OrderPipeline pipeline={data.pipeline} exceptions={data.exceptions} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <ActionQueue items={data.actionQueue} />
        <RecentSubOrders items={data.recentSubOrders} />
      </div>
    </PageBody>
  )
}
