import { AreaTrend, BarSeries, ChartFrame, DonutSplit, SERIES, formatAxisRupees } from '../../components/charts'
import { formatMoney } from '../../components/display'
import { AnalyticsShell } from '../../components/analytics/AnalyticsShell'
import { useAnalyticsController } from '../../controllers/useAnalyticsController'

const TREND_SERIES = [
  { key: 'revenue', label: 'Net revenue' },
  { key: 'refunds', label: 'Refunds' },
]

const CATEGORY_SERIES = [{ key: 'revenue', label: 'Revenue' }]

export function SalesAnalyticsPage() {
  const controller = useAnalyticsController('sales')

  return (
    <AnalyticsShell
      title="Sales analytics"
      description="Revenue, order mix and refunds across the three business models."
      controller={controller}
    >
      {(data) => (
        <>
          <ChartFrame
            title="Revenue and refunds"
            description="Monthly, net of cancellations"
            series={TREND_SERIES}
            height={280}
          >
            <AreaTrend
              data={data.revenueTrend}
              series={TREND_SERIES}
              stacked={false}
              formatAxis={formatAxisRupees}
              formatValue={(value) => formatMoney(value, { compact: true })}
            />
          </ChartFrame>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title="Orders by business model"
              description="Share of order volume, not revenue"
              height={260}
            >
              <DonutSplit
                data={data.ordersByModel}
                formatValue={(value) => value.toLocaleString('en-IN')}
                centreValue={data.ordersByModel
                  .reduce((sum, slice) => sum + slice.value, 0)
                  .toLocaleString('en-IN')}
                centreLabel="orders"
              />
            </ChartFrame>

            <ChartFrame
              title="Payment method mix"
              description="Captured payments by instrument"
              height={260}
            >
              <DonutSplit
                data={data.paymentMix}
                formatValue={(value) => value.toLocaleString('en-IN')}
                centreValue="UPI"
                centreLabel="leads at 65%"
              />
            </ChartFrame>
          </div>

          <ChartFrame
            title="Revenue by category"
            description="Top six categories this period"
            height={300}
          >
            <BarSeries
              data={data.topCategories}
              series={CATEGORY_SERIES}
              horizontal
              formatAxis={formatAxisRupees}
              formatValue={(value) => formatMoney(value, { compact: true })}
            />
          </ChartFrame>
        </>
      )}
    </AnalyticsShell>
  )
}
