import { useState } from 'react'
import { SegmentedControl, Table } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../../admin/components/charts'
import { KeyValueList, SectionCard, formatMoney } from '../../admin/components/display'
import { KpiGrid } from '../../admin/components/dashboard'
import { ErrorState, NoData, PageSkeleton } from '../../admin/components/feedback'
import { DASHBOARD_RANGES } from '../../admin/controllers/useDashboardController'
import { PRODUCT_REVENUE_COLUMNS } from '../../admin/tableColumns/analyticsColumns'
import { useVendorRevenueController } from '../controllers/useVendorController'

const TREND_SERIES = [{ key: 'netSales', label: 'Net sales' }]

const money = (value) => formatMoney(value)

// The seller's own revenue: what they sold, what Krozenda took as commission,
// and what they earned — for a chosen window. The figures are the same ones
// admin sees for this seller; payout status lives on Earnings & Settlements.
export function RevenuePage() {
  const [range, setRange] = useState('30d')
  const { data, isLoading, error, refetch } = useVendorRevenueController(range)
  const hasSales = data?.trend.some((point) => point.netSales > 0)

  return (
    <PageBody>
      <PageHeader
        title="Revenue"
        description="Your sales, Krozenda's commission and your earnings. Paid and pending payouts are under Earnings & Settlements."
        actions={<SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />}
      />

      {isLoading && <PageSkeleton rows={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <>
          <KpiGrid kpis={data.kpis} columns={4} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartFrame title="Net sales" description={data.rangeLabel} series={TREND_SERIES} height={260}>
                {hasSales ? (
                  <AreaTrend
                    data={data.trend}
                    series={TREND_SERIES}
                    formatAxis={formatAxisRupees}
                    formatValue={(value) => formatMoney(value, { compact: true })}
                  />
                ) : (
                  <NoData message="No sales in this window" hint="Try a longer range." />
                )}
              </ChartFrame>
            </div>

            <SectionCard title="Breakdown" description="How your earnings are worked out">
              <div className="px-4 py-2">
                <KeyValueList
                  items={[
                    { label: 'Units sold', value: data.totals.units.toLocaleString('en-IN') },
                    { label: 'Sales', value: money(data.totals.sales) },
                    { label: 'Refunds', value: `− ${money(data.totals.refunds)}` },
                    { label: 'Net sales', value: money(data.totals.netSales) },
                    { label: 'Krozenda commission', value: `− ${money(data.totals.commission)}` },
                    { label: 'Your earnings', value: money(data.totals.sellerEarnings) },
                    { label: 'Not delivered yet', value: money(data.totals.inProgressSales) },
                  ]}
                />
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Top products" description="Your best sellers in this window">
            <Table
              className="rounded-none border-0 border-t"
              columns={PRODUCT_REVENUE_COLUMNS}
              data={data.products}
              getRowKey={(product) => product.id}
              density="compact"
              emptyState={<NoData message="No products sold in this window" />}
            />
          </SectionCard>
        </>
      )}
    </PageBody>
  )
}
