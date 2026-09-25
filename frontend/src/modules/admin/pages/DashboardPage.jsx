import { Button, SegmentedControl } from '../../../components/ui'
import { BUSINESS_MODEL, BUSINESS_MODEL_LABELS } from '../../../config/constants'
import { ADMIN_ROUTES } from '../../../config/routes'
import { PageBody, PageHeader, RefreshControl } from '../components/shell'
import { ErrorState, NoData, PageSkeleton } from '../components/feedback'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../components/charts'
import { formatMoney } from '../components/display'
import {
  ActionQueue,
  IntegrationHealthStrip,
  KpiGrid,
  OrderPipeline,
  OwnStockCard,
  RecentSubOrders,
} from '../components/dashboard'
import { DASHBOARD_RANGES, useDashboardController } from '../controllers/useDashboardController'
import { useOwnStockController } from '../controllers/useOwnStockController'
import { downloadCsv, rupees } from '../lib/exportCsv'

// Fixed series order — a model keeps its colour no matter how many are shown.
const REVENUE_SERIES = [
  { key: BUSINESS_MODEL.MARKETPLACE, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.MARKETPLACE] },
  { key: BUSINESS_MODEL.DROPSHIPPING, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.DROPSHIPPING] },
  { key: BUSINESS_MODEL.OWN_STOCK, label: BUSINESS_MODEL_LABELS[BUSINESS_MODEL.OWN_STOCK] },
]

// The API buckets by day, week or month depending on the range asked for, so
// the chart says which it got rather than claiming "monthly" over daily data.
const GRANULARITY_CAPTION = Object.freeze({
  day: 'Daily gross merchandise value',
  week: 'Weekly gross merchandise value',
  month: 'Monthly gross merchandise value',
})

function exportDashboard(data, range) {
  downloadCsv(`krozenda-dashboard-${range}.csv`, [
    {
      title: 'Headline figures',
      columns: [
        { header: 'Metric', value: (row) => row.label },
        { header: 'Value', value: (row) => (row.format === 'money' ? rupees(row.value) : row.value) },
        { header: 'Unit', value: (row) => (row.format === 'money' ? 'INR' : row.format) },
        { header: 'Change', value: (row) => row.delta?.label ?? '' },
        { header: 'Note', value: (row) => row.caption },
      ],
      rows: data.kpis,
    },
    {
      title: 'Revenue by business model (INR)',
      columns: [
        { header: 'Period', value: (row) => row.label },
        ...REVENUE_SERIES.map((series) => ({
          header: series.label,
          value: (row) => rupees(row[series.key]),
        })),
      ],
      rows: data.revenueByModel,
    },
    {
      title: 'Order pipeline',
      columns: [
        { header: 'Stage', value: (row) => row.label },
        { header: 'Orders', value: (row) => row.count },
      ],
      rows: data.pipeline,
    },
    {
      title: 'Recent sub-orders',
      columns: [
        { header: 'Sub-order', value: (row) => row.id },
        { header: 'Seller', value: (row) => row.seller },
        { header: 'Model', value: (row) => BUSINESS_MODEL_LABELS[row.model] },
        { header: 'Status', value: (row) => row.status },
        { header: 'Value (INR)', value: (row) => rupees(row.total) },
      ],
      rows: data.recentSubOrders,
    },
  ])
}

export function DashboardPage() {
  const { range, setRange, data, isLoading, isFetching, isError, error, refetch, updatedAt } =
    useDashboardController()
  const ownStock = useOwnStockController()

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

  const hasRevenue = data.revenueByModel.some((point) =>
    REVENUE_SERIES.some((series) => point[series.key] > 0),
  )

  return (
    <PageBody>
      <PageHeader
        title="Dashboard"
        description="Marketplace, dropshipping and own stock — one view across all three."
        actions={
          <>
            <SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />
            <RefreshControl updatedAt={updatedAt} isFetching={isFetching} onRefresh={refetch} />
            <Button
              variant="secondary"
              size="control"
              icon="download"
              onClick={() => exportDashboard(data, range)}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {ownStock.canToggle && ownStock.isKnown && (
        <OwnStockCard enabled={ownStock.enabled} isSaving={ownStock.isSaving} onChange={ownStock.setEnabled} />
      )}

      <IntegrationHealthStrip
        integrations={data.integrations}
        to={ADMIN_ROUTES.SETTINGS_INTEGRATIONS}
      />

      <KpiGrid kpis={data.kpis} columns={5} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ChartFrame
          title="Revenue by business model"
          description={GRANULARITY_CAPTION[data.granularity] || GRANULARITY_CAPTION.day}
          series={REVENUE_SERIES}
          height={280}
        >
          {hasRevenue ? (
            <AreaTrend
              data={data.revenueByModel}
              series={REVENUE_SERIES}
              formatAxis={formatAxisRupees}
              formatValue={(value) => formatMoney(value, { compact: true })}
            />
          ) : (
            <NoData
              message="No revenue in this window"
              hint="Every band is zero for the range selected."
            />
          )}
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
