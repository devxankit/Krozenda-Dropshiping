import { Table } from '../../../../components/ui'
import { BarSeries, ChartFrame, DonutSplit, formatAxisCount } from '../../components/charts'
import { SectionCard } from '../../components/display'
import { AnalyticsShell } from '../../components/analytics/AnalyticsShell'
import { useAnalyticsController } from '../../controllers/useAnalyticsController'
import { TOP_CITY_COLUMNS } from '../../tableColumns/analyticsColumns'

const ACQUISITION_SERIES = [
  { key: 'newBuyers', label: 'New buyers' },
  { key: 'returningBuyers', label: 'Returning buyers' },
]

export function CustomerAnalyticsPage() {
  const controller = useAnalyticsController('customers')

  return (
    <AnalyticsShell
      title="Customer insights"
      description="Who is buying, how often they come back, and how much of the book is B2B."
      controller={controller}
    >
      {(data) => (
        <>
          <ChartFrame
            title="New and returning buyers"
            description="Buyers placing at least one order in the month"
            series={ACQUISITION_SERIES}
            height={280}
          >
            <BarSeries
              data={data.acquisition}
              series={ACQUISITION_SERIES}
              stacked
              formatAxis={formatAxisCount}
              formatValue={(value) => value.toLocaleString('en-IN')}
            />
          </ChartFrame>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <ChartFrame
              title="Buyer mix"
              description="Registered accounts by buyer role"
              height={260}
            >
              <DonutSplit
                data={data.buyerMix}
                formatValue={(value) => value.toLocaleString('en-IN')}
                centreValue={data.buyerMix
                  .reduce((sum, slice) => sum + slice.value, 0)
                  .toLocaleString('en-IN')}
                centreLabel="buyers"
              />
            </ChartFrame>

            <SectionCard
              title="Top cities"
              description="Surat is sixth by orders but fourth by revenue — the B2B effect"
            >
              <Table
                className="rounded-none border-0 border-t"
                columns={TOP_CITY_COLUMNS}
                data={data.topCities}
                getRowKey={(city) => city.label}
                density="compact"
              />
            </SectionCard>
          </div>
        </>
      )}
    </AnalyticsShell>
  )
}
