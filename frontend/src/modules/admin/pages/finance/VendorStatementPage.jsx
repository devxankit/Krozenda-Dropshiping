import { useParams } from 'react-router-dom'
import { Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { formatMoney } from '../../components/display'
import { VendorStatementTable } from '../../components/finance/LedgerTables'
import { useVendorStatementController } from '../../controllers/useFinanceController'

// A per-vendor sub-ledger with a running balance. Debit, credit, balance —
// the shape an accountant expects and can tie back to account 2010.
export function VendorStatementPage() {
  const { vendorId } = useParams()
  const { data, isLoading, error, refetch } = useVendorStatementController(vendorId)

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const debits = data.entries.reduce((total, entry) => total + entry.debit, 0)
  const credits = data.entries.reduce((total, entry) => total + entry.credit, 0)

  const tiles = [
    { label: 'Opening balance', value: data.opening },
    { label: 'Credited', value: credits },
    { label: 'Paid out', value: debits },
    { label: 'Closing balance', value: data.closing, emphasis: true },
  ]

  return (
    <PageBody>
      <PageHeader
        title={data.vendor}
        trail={[{ label: data.vendor }]}
        description={`Statement of account · ${data.period}`}
        actions={
          <>
            <Button variant="secondary" size="control" icon="print">
              Print
            </Button>
            <Button variant="secondary" size="control" icon="download">
              Excel
            </Button>
            <Button size="control" icon="download">
              PDF
            </Button>
          </>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <span className="tabular">GSTIN {data.gstin}</span>
          <span className="text-border-strong">·</span>
          <span>Sub-ledger of account 2010 — accounts payable, vendors</span>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={`rounded-lg border p-4 ${tile.emphasis ? 'border-brand-200 bg-brand-50/40' : 'border-border bg-surface'}`}
          >
            <p
              className={`text-2xs font-semibold uppercase tracking-wider ${tile.emphasis ? 'text-brand-600' : 'text-ink-faint'}`}
            >
              {tile.label}
            </p>
            <p
              className={`tabular mt-2 text-lg font-bold tracking-tight ${tile.emphasis ? 'text-brand-700' : 'text-slate-900'}`}
            >
              {formatMoney(tile.value)}
            </p>
          </div>
        ))}
      </div>

      <InlineAlert tone="info" title="Opening plus credits less debits equals closing">
        Credits accrue as sub-orders are delivered. Debits are payouts, commission invoices, TDS
        and any RTO recovery charged back to the vendor.
      </InlineAlert>

      <VendorStatementTable statement={data} debits={debits} credits={credits} />
    </PageBody>
  )
}
