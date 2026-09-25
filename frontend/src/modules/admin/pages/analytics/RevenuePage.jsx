import { useMemo, useState } from 'react'
import { Button, Input, SegmentedControl, Table } from '../../../../components/ui'
import { AreaTrend, ChartFrame, formatAxisRupees } from '../../components/charts'
import { KeyValueList, SectionCard, formatMoney } from '../../components/display'
import { KpiGrid } from '../../components/dashboard'
import { ErrorState, NoData, PageSkeleton } from '../../components/feedback'
import { AnalyticsShell } from '../../components/analytics/AnalyticsShell'
import {
  REVENUE_CHANNELS,
  useRevenueController,
  useSellerRevenueController,
} from '../../controllers/useRevenueController'
import { PRODUCT_REVENUE_COLUMNS, SELLER_REVENUE_COLUMNS } from '../../tableColumns/analyticsColumns'
import { downloadCsv, rupees } from '../../lib/exportCsv'

const TREND_SERIES = [
  { key: 'own_stock', label: 'Own stock' },
  { key: 'cj', label: 'CJ Dropshipping' },
  { key: 'sellers', label: 'Sellers' },
]

const SELLER_TREND_SERIES = [{ key: 'netSales', label: 'Net sales' }]

const GRANULARITY_CAPTION = Object.freeze({
  day: 'Daily net sales by channel',
  week: 'Weekly net sales by channel',
  month: 'Monthly net sales by channel',
})

const money = (value) => formatMoney(value)
const compact = (value) => formatMoney(value, { compact: true })

// What each channel's card shows. Krozenda's share is worked out differently
// per channel, so each card says how.
function channelRows(channel, notes) {
  const common = [
    { label: 'Orders', value: channel.orders.toLocaleString('en-IN') },
    { label: 'Sales', value: money(channel.sales) },
    { label: 'Refunds', value: money(channel.refunds) },
    { label: 'Net sales', value: money(channel.netSales) },
    { label: 'Not delivered yet', value: money(channel.inProgressSales) },
  ]
  if (channel.key === 'sellers') {
    return [
      ...common,
      { label: 'Krozenda commission', value: money(channel.commission) },
      { label: 'Sellers earned', value: money(channel.sellerEarnings) },
    ]
  }
  if (channel.key === 'cj') {
    return [
      ...common,
      { label: `CJ cost (₹${notes.cjUsdToInrRate}/USD)`, value: money(channel.cost) },
      { label: 'Krozenda margin', value: money(channel.earnings) },
    ]
  }
  return [
    ...common,
    { label: 'Product cost', value: money(channel.cost) },
    { label: 'Krozenda profit', value: money(channel.earnings) },
  ]
}

const CHANNEL_NOTES = Object.freeze({
  own_stock: 'Profit = net sales − product cost price',
  cj: 'Margin = net sales − what CJ charged',
  sellers: 'Krozenda keeps the commission; the rest is the sellers’',
})

function exportRevenue(data, range) {
  const figureColumns = [
    { header: 'Orders', value: (row) => row.orders },
    { header: 'Sales (INR)', value: (row) => rupees(row.sales) },
    { header: 'Refunds (INR)', value: (row) => rupees(row.refunds) },
    { header: 'Net sales (INR)', value: (row) => rupees(row.netSales) },
    { header: 'Commission (INR)', value: (row) => rupees(row.commission) },
    { header: 'Cost (INR)', value: (row) => rupees(row.cost) },
    { header: 'Krozenda earnings (INR)', value: (row) => rupees(row.earnings) },
    { header: 'Seller earnings (INR)', value: (row) => rupees(row.sellerEarnings) },
  ]
  downloadCsv(`krozenda-revenue-${range}.csv`, [
    {
      title: 'By channel',
      columns: [{ header: 'Channel', value: (row) => row.label }, ...figureColumns],
      rows: data.channels,
    },
    {
      title: 'By seller',
      columns: [{ header: 'Seller', value: (row) => row.name }, ...figureColumns],
      rows: data.sellers,
    },
    {
      title: 'Net sales by period (INR)',
      columns: [
        { header: 'Period', value: (row) => row.label },
        ...TREND_SERIES.map((s) => ({ header: s.label, value: (row) => rupees(row[s.key]) })),
      ],
      rows: data.trend,
    },
  ])
}

function SellerDetail({ sellerId, range, onClose }) {
  const { data, isLoading, error, refetch } = useSellerRevenueController(sellerId, range)
  const hasSales = data?.trend.some((point) => point.netSales > 0)

  return (
    <SectionCard
      title={data ? data.seller.name : 'Seller revenue'}
      description="This seller only — the same figures they see on their own Revenue screen"
      actions={
        <Button variant="secondary" size="control" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {isLoading && <PageSkeleton rows={1} />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {data && (
          <>
            <KpiGrid kpis={data.kpis} columns={4} />
            <ChartFrame title="Net sales" series={SELLER_TREND_SERIES} height={220}>
              {hasSales ? (
                <AreaTrend
                  data={data.trend}
                  series={SELLER_TREND_SERIES}
                  formatAxis={formatAxisRupees}
                  formatValue={compact}
                />
              ) : (
                <NoData message="No sales in this window" />
              )}
            </ChartFrame>
            <Table
              columns={PRODUCT_REVENUE_COLUMNS}
              data={data.products}
              getRowKey={(product) => product.id}
              density="compact"
              emptyState={<NoData message="No products sold in this window" />}
            />
          </>
        )}
      </div>
    </SectionCard>
  )
}

export function RevenuePage() {
  const controller = useRevenueController()
  const [search, setSearch] = useState('')
  const [selectedSeller, setSelectedSeller] = useState(null)

  return (
    <AnalyticsShell
      title="Revenue"
      description="What was sold, and what Krozenda and each seller earned — own stock, CJ Dropshipping and sellers."
      controller={controller}
      onExport={exportRevenue}
      showTabs={false}
      toolbar={
        <SegmentedControl
          items={REVENUE_CHANNELS}
          activeId={controller.channel}
          onChange={controller.setChannel}
        />
      }
    >
      {(data) => (
        <RevenueBody
          data={data}
          channel={controller.channel}
          range={controller.range}
          search={search}
          onSearch={setSearch}
          selectedSeller={selectedSeller}
          onSelectSeller={setSelectedSeller}
        />
      )}
    </AnalyticsShell>
  )
}

function RevenueBody({ data, channel, range, search, onSearch, selectedSeller, onSelectSeller }) {
  const sellers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? data.sellers.filter((s) => s.name.toLowerCase().includes(term)) : data.sellers
  }, [data.sellers, search])
  // 'all' shows the three side by side; a single channel shows only itself.
  const shownChannels = channel === 'all' ? data.channels : data.channels.filter((c) => c.key === channel)
  const series = channel === 'all' ? TREND_SERIES : TREND_SERIES.filter((s) => s.key === channel)
  const hasSales = data.trend.some((point) => series.some((s) => point[s.key] > 0))
  const showSellers = channel === 'all' || channel === 'sellers'

  return (
    <>
      <div className={`grid gap-4 ${channel === 'all' ? 'xl:grid-cols-3' : ''}`}>
        {shownChannels.map((channel) => (
          <SectionCard key={channel.key} title={channel.label} description={CHANNEL_NOTES[channel.key]}>
            <div className="px-4 pb-2 pt-3">
              <div className="text-xs text-ink-subtle">Krozenda earned</div>
              <div className="tabular text-2xl font-semibold text-slate-900">{money(channel.earnings)}</div>
            </div>
            <div className="px-4 pb-3">
              <KeyValueList items={channelRows(channel, data.notes)} />
              {channel.key === 'own_stock' && data.notes.ownStockLinesWithoutCost > 0 && (
                <p className="mt-2 text-xs text-warning-700">
                  {data.notes.ownStockLinesWithoutCost} sold line(s) have no cost price, so their cost is
                  counted as ₹0 — set a cost price on those products for a true profit.
                </p>
              )}
            </div>
          </SectionCard>
        ))}
      </div>

      <ChartFrame
        title={channel === 'all' ? 'Net sales by channel' : `Net sales — ${series[0]?.label}`}
        description={`${GRANULARITY_CAPTION[data.granularity] || GRANULARITY_CAPTION.day} · shipping collected ${money(data.totals.shippingFees)} is not included`}
        series={series}
        height={280}
      >
        {hasSales ? (
          <AreaTrend data={data.trend} series={series} formatAxis={formatAxisRupees} formatValue={compact} />
        ) : (
          <NoData message="No sales in this window" hint="Nothing was sold over the range selected." />
        )}
      </ChartFrame>

      {showSellers && selectedSeller && (
        <SellerDetail sellerId={selectedSeller} range={range} onClose={() => onSelectSeller(null)} />
      )}

      {showSellers && (
        <SectionCard
          title="Revenue by seller"
          description="Click a seller for their trend and top products"
          actions={
            <Input
              size="sm"
              icon="search"
              placeholder="Search seller"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              aria-label="Search seller"
            />
          }
        >
          <Table
            className="rounded-none border-0 border-t"
            columns={SELLER_REVENUE_COLUMNS}
            data={sellers}
            getRowKey={(seller) => seller.id}
            onRowClick={(seller) => onSelectSeller(seller.id)}
            density="compact"
            emptyState={
              <NoData message={search ? 'No seller matches that search' : 'No seller sales in this window'} />
            }
          />
        </SectionCard>
      )}
    </>
  )
}
