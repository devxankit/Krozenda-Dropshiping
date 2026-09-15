import { PageBody, PageHeader } from '../../admin/components/shell'
import { StatTile } from '../../admin/components/StatTile'
import { SectionCard } from '../../admin/components/display'
import { MoneyCell } from '../../admin/components/display/cells'
import { useVendorAnalyticsController } from '../controllers/useVendorController'

export function AnalyticsPage() {
  const { data, isLoading } = useVendorAnalyticsController()

  if (isLoading || !data) {
    return (
      <PageBody>
        <PageHeader title="Analytics" description="Sales trend, top products and order mix for the last 30 days." />
        <p className="text-xs text-ink-subtle">Loading analytics…</p>
      </PageBody>
    )
  }

  const totalRevenue = data.salesTrend.reduce((sum, d) => sum + d.revenue, 0)
  const totalOrders = data.salesTrend.reduce((sum, d) => sum + d.orders, 0)

  return (
    <PageBody>
      <PageHeader title="Analytics" description="Sales trend, top products and order mix for the last 30 days." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Revenue (30d)" value={`₹${(totalRevenue / 100).toLocaleString('en-IN')}`} tone="brand" />
        <StatTile label="Orders (30d)" value={totalOrders} />
        <StatTile label="Active Products" value={data.productsActive} caption={`of ${data.productsTotal} total`} />
        <StatTile label="Top Product Revenue" value={data.topProducts[0] ? `₹${(data.topProducts[0].revenue / 100).toLocaleString('en-IN')}` : '—'} caption={data.topProducts[0]?.name || ''} />
      </div>

      <SectionCard title="Top Products" description="Ranked by revenue, all-time">
        <div className="divide-y divide-border">
          {data.topProducts.length === 0 && <p className="p-4 text-xs text-ink-subtle">No sales yet.</p>}
          {data.topProducts.map((p, idx) => (
            <div key={p.productId} className="flex items-center justify-between px-4 py-3 text-xs">
              <span className="font-medium text-slate-900">{idx + 1}. {p.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-ink-subtle">{p.unitsSold} sold</span>
                <MoneyCell amount={p.revenue} compact />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Order Status Mix" description="All-time, across your line items">
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          {Object.entries(data.orderStatusBreakdown).map(([status, count]) => (
            <div key={status} className="rounded-lg border border-border p-3 text-center">
              <p className="text-lg font-bold text-slate-900">{count}</p>
              <p className="text-2xs text-ink-subtle">{status}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageBody>
  )
}
