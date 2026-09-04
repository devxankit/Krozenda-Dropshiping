import { Table } from '../../../../components/ui'
import { AreaTrend, ChartFrame } from '../../components/charts'
import { SectionCard } from '../../components/display'
import { AnalyticsShell } from '../../components/analytics/AnalyticsShell'
import { useAnalyticsController } from '../../controllers/useAnalyticsController'
import { VENDOR_PERFORMANCE_COLUMNS } from '../../tableColumns/analyticsColumns'

const SPEED_SERIES = [
  { key: 'dispatchHours', label: 'Dispatch (hours)' },
  { key: 'transitDays', label: 'Transit (days)' },
]

export function VendorAnalyticsPage() {
  const controller = useAnalyticsController('vendors')

  return (
    <AnalyticsShell
      title="Vendor performance"
      description="Who accepts fast, ships fast, and whose consignments come back."
      controller={controller}
    >
      {(data) => (
        <>
          <ChartFrame
            title="Fulfilment speed"
            description="Median hours from vendor acceptance to AWB, and days in transit"
            series={SPEED_SERIES}
            height={260}
          >
            <AreaTrend
              data={data.fulfilmentSpeed}
              series={SPEED_SERIES}
              stacked={false}
              formatValue={(value) => value.toFixed(1)}
            />
          </ChartFrame>

          <SectionCard
            title="Vendors by revenue"
            description="Red marks a vendor past the platform's dispatch or RTO threshold"
          >
            <Table
              className="rounded-none border-0 border-t"
              columns={VENDOR_PERFORMANCE_COLUMNS}
              data={data.vendors}
              getRowKey={(vendor) => vendor.id}
              density="compact"
            />
          </SectionCard>
        </>
      )}
    </AnalyticsShell>
  )
}
