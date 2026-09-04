import { Table } from '../../../../components/ui'
import { BarSeries, ChartFrame, formatAxisRupees } from '../../components/charts'
import { SectionCard, formatMoney } from '../../components/display'
import { AnalyticsShell } from '../../components/analytics/AnalyticsShell'
import { useAnalyticsController } from '../../controllers/useAnalyticsController'
import { STOCK_RISK_COLUMNS, TOP_PRODUCT_COLUMNS } from '../../tableColumns/analyticsColumns'

const CATEGORY_SERIES = [{ key: 'revenue', label: 'Revenue' }]

export function CatalogAnalyticsPage() {
  const controller = useAnalyticsController('catalog')

  return (
    <AnalyticsShell
      title="Catalog performance"
      description="What sells, what comes back, and what is about to run out."
      controller={controller}
    >
      {(data) => (
        <>
          <ChartFrame
            title="Revenue by category"
            description="Top six categories this period"
            height={280}
          >
            <BarSeries
              data={data.categoryRevenue}
              series={CATEGORY_SERIES}
              horizontal
              formatAxis={formatAxisRupees}
              formatValue={(value) => formatMoney(value, { compact: true })}
            />
          </ChartFrame>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <SectionCard
              title="Best sellers"
              description="Red marks a return rate above the 3% review threshold"
            >
              <Table
                className="rounded-none border-0 border-t"
                columns={TOP_PRODUCT_COLUMNS}
                data={data.topProducts}
                getRowKey={(product) => product.id}
                density="compact"
              />
            </SectionCard>

            <SectionCard title="Running out" description="Days of cover at the current sales rate">
              <Table
                className="rounded-none border-0 border-t"
                columns={STOCK_RISK_COLUMNS}
                data={data.stockRisk}
                getRowKey={(item) => item.id}
                density="compact"
              />
            </SectionCard>
          </div>
        </>
      )}
    </AnalyticsShell>
  )
}
