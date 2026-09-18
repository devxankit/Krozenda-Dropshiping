import { useState } from 'react'
import { Badge, Tabs } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { DataTable } from '../../admin/components/data/DataTable'
import { DateCell, MoneyCell } from '../../admin/components/display/cells'
import { useVendorEarningsController } from '../controllers/useVendorController'

// What a row is waiting on. The three states are genuinely different things,
// and collapsing them (as this screen used to, by showing every delivered line
// as "pending") is what made the old page unable to answer "when am I paid".
const EARNING_STATE = Object.freeze({
  PAID: { tone: 'success', label: 'Paid' },
  IN_BATCH: { tone: 'brand', label: 'In settlement' },
  UNSETTLED: { tone: 'warning', label: 'Awaiting settlement' },
})

const PAYOUT_TONE = Object.freeze({
  COMPLETED: 'success',
  PROCESSING: 'brand',
  PENDING: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
})

const EARNING_COLUMNS = [
  {
    key: 'productName',
    header: 'Product',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">
          {row.productName} × {row.quantity}
        </span>
        {row.settlementId && <span className="text-2xs text-ink-subtle">{row.settlementId}</span>}
      </div>
    ),
  },
  {
    key: 'state',
    header: 'Status',
    width: '10rem',
    render: (row) => (
      <Badge tone={EARNING_STATE[row.state].tone} size="sm">
        {EARNING_STATE[row.state].label}
      </Badge>
    ),
  },
  { key: 'grossAmount', header: 'Gross', width: '8rem', align: 'right', render: (row) => <MoneyCell amount={row.grossAmount} compact /> },
  {
    key: 'commission',
    header: 'Commission',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} compact muted />,
  },
  {
    key: 'netAmount',
    header: 'Net Earning',
    width: '8.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.netAmount} compact className="text-emerald-600" />,
  },
  { key: 'deliveredAt', header: 'Delivered', width: '8rem', render: (row) => <DateCell value={row.deliveredAt} withTime={false} /> },
]

const PAYOUT_COLUMNS = [
  {
    key: 'payoutId',
    header: 'Payout',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.payoutId}</span>
        <span className="text-2xs text-ink-subtle">
          {row.bankName ? `${row.bankName} · ` : ''}
          {row.bankAccountMasked || 'No bank on record'}
          {row.attempt > 1 ? ` · attempt ${row.attempt}` : ''}
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <Badge tone={PAYOUT_TONE[row.status] || 'neutral'} size="sm">
          {row.status}
        </Badge>
        {/* A seller is entitled to know why a transfer to them failed, rather
            than watching a number sit still with no explanation. */}
        {row.status === 'FAILED' && row.failureReason && (
          <span className="text-2xs text-danger-600">{row.failureReason}</span>
        )}
      </div>
    ),
  },
  { key: 'amount', header: 'Amount', width: '9rem', align: 'right', render: (row) => <MoneyCell amount={row.amount} /> },
  {
    key: 'utr',
    header: 'UTR',
    width: '10rem',
    render: (row) => <span className="text-xs text-ink-muted">{row.utr || '—'}</span>,
  },
  { key: 'processedAt', header: 'Processed', width: '9rem', render: (row) => <DateCell value={row.processedAt || row.createdAt} /> },
]

function Tile({ label, value, caption, tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</span>
      <div className={`mt-2 text-xl font-bold ${tone || 'text-slate-900'}`}>
        <MoneyCell amount={value} className={tone} />
      </div>
      {caption && <span className="mt-1 block text-2xs text-ink-subtle">{caption}</span>}
    </div>
  )
}

export function EarningsPage() {
  const { summary, entries, payouts, isLoading, isLoadingPayouts } = useVendorEarningsController()
  const [tab, setTab] = useState('earnings')

  return (
    <PageBody>
      <PageHeader
        title="Earnings & Settlements"
        description="Your sales, commission and what has actually been paid out — read from the same ledger the platform settles from."
      />

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Net earnings" value={summary.netEarnings} caption={`on ${summary.deliveredOrdersCount} delivered items`} />
          <Tile
            label="Paid out"
            value={summary.paidAmount}
            tone="text-emerald-600"
            caption={`${summary.completedPayoutsCount} completed ${summary.completedPayoutsCount === 1 ? 'payout' : 'payouts'}`}
          />
          <Tile label="In settlement" value={summary.inBatchAmount} tone="text-brand-600" caption="Batched, transfer not sent yet" />
          <Tile label="Awaiting settlement" value={summary.unsettledAmount} tone="text-amber-600" caption="Delivered, not yet batched" />
        </div>
      )}

      {summary && (
        <p className="mb-4 text-2xs text-ink-subtle">
          Commission shown per line is the rate actually charged. Your default rate is{' '}
          {summary.commissionRatePercent}%, but a category or product rule set by the platform can override it on
          individual items.
        </p>
      )}

      <Tabs
        items={[
          { id: 'earnings', label: 'Earnings', count: entries.length },
          { id: 'payouts', label: 'Payouts', count: payouts.length },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === 'earnings' ? (
          <DataTable
            columns={EARNING_COLUMNS}
            data={entries}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            emptyTitle="No earnings yet"
            emptyDescription="Earnings from delivered orders will show up here."
          />
        ) : (
          <DataTable
            columns={PAYOUT_COLUMNS}
            data={payouts}
            getRowKey={(row) => row.id}
            isLoading={isLoadingPayouts}
            emptyTitle="No payouts yet"
            emptyDescription="Once a settlement batch is approved and paid, the transfer shows up here with its UTR."
          />
        )}
      </div>
    </PageBody>
  )
}
