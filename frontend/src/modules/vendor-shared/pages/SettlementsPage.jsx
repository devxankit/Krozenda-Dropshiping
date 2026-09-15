import { PageBody, PageHeader } from '../../admin/components/shell'
import { DataTable } from '../../admin/components/data/DataTable'
import { MoneyCell } from '../../admin/components/display/cells'
import { useVendorEarningsController } from '../controllers/useVendorController'

export function EarningsPage() {
  const { summary, entries, isLoading } = useVendorEarningsController()

  const columns = [
    { key: 'productName', header: 'Product', render: (row) => <span className="text-xs font-medium text-slate-900">{row.productName} × {row.quantity}</span> },
    { key: 'grossAmount', header: 'Gross', width: '8rem', align: 'right', render: (row) => <MoneyCell amount={row.grossAmount} compact /> },
    { key: 'commission', header: 'Commission', width: '8rem', align: 'right', render: (row) => <MoneyCell amount={row.commission} compact muted /> },
    { key: 'netAmount', header: 'Net Earning', width: '8.5rem', align: 'right', render: (row) => <MoneyCell amount={row.netAmount} compact className="text-emerald-600" /> },
    { key: 'deliveredAt', header: 'Delivered', width: '8rem', render: (row) => <span className="text-xs text-ink-muted">{row.deliveredAt ? new Date(row.deliveredAt).toLocaleDateString('en-IN') : '—'}</span> },
  ]

  return (
    <PageBody>
      <PageHeader title="Earnings & Settlements" description="Your sales, commission and net earnings from delivered orders." />

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Total Sales</span>
            <div className="mt-2 text-xl font-bold text-slate-900"><MoneyCell amount={summary.totalSales} /></div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Commission ({summary.commissionRatePercent}%)</span>
            <div className="mt-2 text-xl font-bold text-slate-900"><MoneyCell amount={summary.totalCommission} /></div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Net Earnings</span>
            <div className="mt-2 text-xl font-bold text-emerald-600"><MoneyCell amount={summary.netEarnings} className="text-emerald-600" /></div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">Pending Settlement</span>
            <div className="mt-2 text-xl font-bold text-amber-600"><MoneyCell amount={summary.pendingAmount} className="text-amber-600" /></div>
            <span className="mt-1 block text-2xs text-ink-subtle">Paid: <MoneyCell amount={summary.paidAmount} compact /></span>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={entries}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="No earnings yet"
        emptyDescription="Earnings from delivered orders will show up here."
      />
    </PageBody>
  )
}
