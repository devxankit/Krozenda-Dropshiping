import { Button, SegmentedControl } from '../../../../components/ui'
import { PageBody, PageHeader, RefreshControl } from '../../components/shell'
import { ErrorState, InlineAlert, NoData, PageSkeleton } from '../../components/feedback'
import { formatMoney } from '../../components/display'
import { KpiGrid } from '../../components/dashboard'
import {
  AreaTrend,
  BarSeries,
  ChartFrame,
  DonutSplit,
  formatAxisRupees,
} from '../../components/charts'
import { useAnalyticsController } from '../../controllers/useAnalyticsController'
import { DASHBOARD_RANGES } from '../../controllers/useDashboardController'
import { downloadCsv, rupees } from '../../lib/exportCsv'

const TREND_SERIES = [
  { key: 'revenue', label: 'Net revenue' },
  { key: 'refunds', label: 'Refunds' },
]

const CATEGORY_SERIES = [{ key: 'revenue', label: 'Revenue' }]

const GRANULARITY_CAPTION = Object.freeze({
  day: 'Daily, net of cancellations',
  week: 'Weekly, net of cancellations',
  month: 'Monthly, net of cancellations',
})

const formatCount = (value) => value.toLocaleString('en-IN')

function exportReport(data, range) {
  downloadCsv(`krozenda-reports-${range}.csv`, [
    {
      title: 'Headline figures',
      columns: [
        { header: 'Metric', value: (row) => row.label },
        { header: 'Value', value: (row) => (row.format === 'money' ? rupees(row.value) : row.value) },
        { header: 'Unit', value: (row) => (row.format === 'money' ? 'INR' : row.format) },
        { header: 'Change', value: (row) => row.delta?.label ?? '' },
      ],
      rows: data.kpis,
    },
    {
      title: 'Revenue and refunds (INR)',
      columns: [
        { header: 'Period', value: (row) => row.label },
        { header: 'Net revenue', value: (row) => rupees(row.revenue) },
        { header: 'Refunds', value: (row) => rupees(row.refunds) },
      ],
      rows: data.revenueTrend,
    },
    {
      title: 'Sub-orders by business model',
      columns: [
        { header: 'Business model', value: (row) => row.label },
        { header: 'Sub-orders', value: (row) => row.value },
      ],
      rows: data.ordersByModel,
    },
    {
      title: 'Revenue by category',
      columns: [
        { header: 'Category', value: (row) => row.label },
        { header: 'Revenue (INR)', value: (row) => rupees(row.revenue) },
        { header: 'Orders', value: (row) => row.orders },
      ],
      rows: data.topCategories,
    },
    {
      title: 'Captured payments by instrument',
      columns: [
        { header: 'Instrument', value: (row) => row.label },
        { header: 'Orders', value: (row) => row.value },
      ],
      rows: data.paymentMix,
    },
  ])
}

// The reports landing is the sales report, live off /admin/analytics/sales —
// one polished view rather than a catalogue of report stubs with nothing
// behind them.
export function ReportsPage() {
  const { range, setRange, data, isLoading, isFetching, error, refetch, updatedAt, isLive } =
    useAnalyticsController('sales')

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Revenue, order mix and refunds across the three business models."
        actions={
          <>
            <SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />
            <RefreshControl
              updatedAt={updatedAt}
              isFetching={isFetching}
              onRefresh={refetch}
              live={isLive}
            />
            <Button
              variant="secondary"
              size="control"
              icon="download"
              disabled={!data}
              onClick={() => exportReport(data, range)}
            >
              Export CSV
            </Button>
          </>
        }
      />

      {isLive === false && (
        <InlineAlert tone="info" title="Sample data">
          This view is not wired to the reporting API yet — the figures below are illustrative.
        </InlineAlert>
      )}

      {isLoading && <PageSkeleton rows={3} />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {data && (
        <>
          <KpiGrid kpis={data.kpis} columns={4} />

          <ChartFrame
            title="Revenue and refunds"
            description={GRANULARITY_CAPTION[data.granularity] || GRANULARITY_CAPTION.day}
            series={TREND_SERIES}
            height={280}
          >
            {data.revenueTrend.some((point) => point.revenue > 0 || point.refunds > 0) ? (
              <AreaTrend
                data={data.revenueTrend}
                series={TREND_SERIES}
                stacked={false}
                formatAxis={formatAxisRupees}
                formatValue={(value) => formatMoney(value, { compact: true })}
              />
            ) : (
              <NoData
                message="No revenue in this window"
                hint="Nothing was sold or refunded over the range selected."
              />
            )}
          </ChartFrame>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title="Sub-orders by business model"
              description="Share of order volume, not revenue"
              height={260}
            >
              {data.ordersByModel.reduce((sum, slice) => sum + slice.value, 0) > 0 ? (
                <DonutSplit
                  data={data.ordersByModel}
                  formatValue={formatCount}
                  centreValue={formatCount(data.ordersByModel.reduce((sum, s) => sum + s.value, 0))}
                  centreLabel="sub-orders"
                />
              ) : (
                <NoData message="No sub-orders in this window" />
              )}
            </ChartFrame>

            <ChartFrame
              title="Payment method mix"
              description="Captured payments by instrument"
              height={260}
            >
              {data.paymentMix.length > 0 ? (
                <DonutSplit
                  data={data.paymentMix}
                  formatValue={formatCount}
                  centreValue={`${Math.round(
                    (data.paymentMix[0].value /
                      data.paymentMix.reduce((sum, s) => sum + s.value, 0)) *
                      100,
                  )}%`}
                  centreLabel={data.paymentMix[0].label}
                />
              ) : (
                <NoData
                  message="Nothing captured in this window"
                  hint="COD orders count once they are delivered."
                />
              )}
            </ChartFrame>
          </div>

          <ChartFrame
            title="Revenue by category"
            description="Top six categories in this window — order counts are in the CSV export"
            height={300}
          >
            {data.topCategories.length > 0 ? (
              <BarSeries
                data={data.topCategories}
                series={CATEGORY_SERIES}
                horizontal
                formatAxis={formatAxisRupees}
                formatValue={(value) => formatMoney(value, { compact: true })}
              />
            ) : (
              <NoData message="No category revenue in this window" />
            )}
          </ChartFrame>
        </>
      )}
    </PageBody>
  )
}
