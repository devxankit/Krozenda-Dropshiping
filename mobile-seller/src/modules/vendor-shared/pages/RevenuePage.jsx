import { useState } from 'react'
import { View } from 'react-native'
import { SegmentedControl, Table } from '../../../components/ui'
import { PageBody, PageHeader } from '../../../components/admin/shell'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../../../components/admin/charts'
import { KeyValueList, SectionCard, formatMoney } from '../../../components/admin/display'
import { KpiGrid } from '../../../components/admin/dashboard'
import { ErrorState, NoData, PageSkeleton } from '../../../components/admin/feedback'
import { formatIndian } from '../../../lib/format'
import { DASHBOARD_RANGES } from '../../admin/controllers/useDashboardController'
import { PRODUCT_REVENUE_COLUMNS } from '../tableColumns/financeColumns'
import { useVendorRevenueController } from '../controllers/useVendorController'

const TREND_SERIES = [{ key: 'netSales', label: 'Net sales' }]

const money = (value) => formatMoney(value)

// The seller's own revenue: what they sold, what Krozenda took as commission,
// and what they earned — for a chosen window. Payout status lives on Earnings & Settlements.
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

      {isLoading ? <PageSkeleton rows={2} /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {data ? (
        <>
          <KpiGrid kpis={data.kpis} columns={4} />

          <View style={{ gap: 16 }}>
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

            <SectionCard title="Breakdown" description="How your earnings are worked out">
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <KeyValueList
                  items={[
                    { label: 'Units sold', value: formatIndian(data.totals.units) },
                    { label: 'Sales', value: money(data.totals.sales) },
                    { label: 'Refunds', value: `− ${money(data.totals.refunds)}` },
                    { label: 'Net sales', value: money(data.totals.netSales) },
                    { label: 'Krozenda commission', value: `− ${money(data.totals.commission)}` },
                    { label: 'Your earnings', value: money(data.totals.sellerEarnings) },
                    { label: 'Not delivered yet', value: money(data.totals.inProgressSales) },
                  ]}
                />
              </View>
            </SectionCard>
          </View>

          <SectionCard title="Top products" description="Your best sellers in this window">
            <Table
              columns={PRODUCT_REVENUE_COLUMNS}
              data={data.products}
              getRowKey={(product) => product.id}
              density="compact"
              emptyState={<NoData message="No products sold in this window" />}
            />
          </SectionCard>
        </>
      ) : null}
    </PageBody>
  )
}
