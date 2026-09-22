import { useState } from 'react'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { StatTile } from '../../admin/components/StatTile'
import { SectionCard } from '../../admin/components/display'
import { MoneyCell } from '../../admin/components/display/cells'
import { Button } from '../../../components/ui'
import { downloadCsv, rupees } from '../../admin/lib/exportCsv'
import { useVendorReportsController } from '../controllers/useVendorController'

function toInputDate(date) {
  return date.toISOString().slice(0, 10)
}

function defaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)
  return { from: toInputDate(from), to: toInputDate(to) }
}

export function ReportsPage() {
  const [range, setRange] = useState(defaultRange)
  const { data, isLoading } = useVendorReportsController(range)

  const handleExport = () => {
    if (!data) return
    downloadCsv(`sales-report-${range.from}-to-${range.to}.csv`, [
      {
        title: 'Daily sales',
        columns: [
          { header: 'Date', value: (row) => row.date },
          { header: 'Orders', value: (row) => row.orders },
          { header: 'Units', value: (row) => row.units },
          { header: 'Revenue (INR)', value: (row) => rupees(row.revenue) },
        ],
        rows: data.dailySales,
      },
      {
        title: 'Product performance',
        columns: [
          { header: 'Product', value: (row) => row.name },
          { header: 'Units sold', value: (row) => row.unitsSold },
          { header: 'Revenue (INR)', value: (row) => rupees(row.revenue) },
        ],
        rows: data.productPerformance,
      },
    ])
  }

  return (
    <PageBody>
      <PageHeader
        title="Reports"
        description="Sales, orders and product performance for a date range you pick."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                type="date"
                value={range.from}
                max={range.to}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="w-full rounded-lg border border-border px-2 py-1.5 text-xs sm:w-auto"
              />
              <span className="hidden shrink-0 text-xs text-ink-subtle sm:inline">to</span>
              <input
                type="date"
                value={range.to}
                min={range.from}
                max={toInputDate(new Date())}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="w-full rounded-lg border border-border px-2 py-1.5 text-xs sm:w-auto"
              />
            </div>
            <Button
              variant="secondary"
              size="control"
              icon="download"
              onClick={handleExport}
              disabled={!data}
              className="w-full sm:w-auto"
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {isLoading || !data ? (
        <p className="text-xs text-ink-subtle">Loading report…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Revenue" value={`₹${(data.totals.revenue / 100).toLocaleString('en-IN')}`} tone="brand" />
            <StatTile label="Orders" value={data.totals.orders} />
            <StatTile label="Units sold" value={data.totals.units} />
            <StatTile label="Avg. order value" value={`₹${(data.totals.avgOrderValue / 100).toLocaleString('en-IN')}`} />
          </div>

          <SectionCard title="Daily sales" description={`${range.from} to ${range.to}`}>
            <div className="divide-y divide-border">
              {data.dailySales.length === 0 && <p className="p-4 text-xs text-ink-subtle">No sales in this period.</p>}
              {data.dailySales.map((d) => (
                <div key={d.date} className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="font-medium text-slate-900">{d.date}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-ink-subtle">{d.orders} orders</span>
                    <span className="text-ink-subtle">{d.units} units</span>
                    <MoneyCell amount={d.revenue} compact />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Product performance" description="Top 20 by revenue in this period">
            <div className="divide-y divide-border">
              {data.productPerformance.length === 0 && (
                <p className="p-4 text-xs text-ink-subtle">No product sales in this period.</p>
              )}
              {data.productPerformance.map((p, idx) => (
                <div key={p.productId || p.name} className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="font-medium text-slate-900">{idx + 1}. {p.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-ink-subtle">{p.unitsSold} sold</span>
                    <MoneyCell amount={p.revenue} compact />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Order status mix" description="Across order lines in this period">
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              {Object.entries(data.orderStatusBreakdown).map(([status, count]) => (
                <div key={status} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{count}</p>
                  <p className="text-2xs text-ink-subtle">{status}</p>
                </div>
              ))}
              {Object.keys(data.orderStatusBreakdown).length === 0 && (
                <p className="col-span-full text-xs text-ink-subtle">No orders in this period.</p>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </PageBody>
  )
}
