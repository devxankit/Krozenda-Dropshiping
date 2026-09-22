import { useState } from 'react'
import { Badge, Button, Input, Modal, Pagination, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { MoneyCell, DateCell } from '../../components/display'
import {
  useCreateVendorPayoutController,
  useVendorPayoutLogController,
  useVendorPayoutSummaryController,
} from '../../controllers/useAccountsController'

// Accounts MVP — vendor payouts. Deliberately separate from the existing
// Accounting module's Settlements/Payouts screens: no settlement batches, no
// commission calc, just "what's owed vs what's been paid" per vendor and a
// manual log of payments made.

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'OTHER', label: 'Other' },
]

function PayForm({ vendor, onClose }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [note, setNote] = useState('')

  const create = useCreateVendorPayoutController({ onSaved: onClose })

  const submit = () => {
    if (!amount || Number(amount) <= 0) return
    create.run({ vendor: vendor.id, amount: Number(amount), method, note })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Pay ${vendor.name}`}
      description="Records a payout already made — this does not move money."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={create.isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="control"
            onClick={submit}
            isLoading={create.isSubmitting}
            disabled={!amount || Number(amount) <= 0}
          >
            Record payout
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          id="payout-amount"
          label="Amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          id="payout-method"
          label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={METHODS}
        />
        <Input id="payout-note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

export function VendorPayoutsPage() {
  const summary = useVendorPayoutSummaryController()
  const log = useVendorPayoutLogController()
  const [payingVendor, setPayingVendor] = useState(null)

  const summaryColumns = [
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row) => <span className="font-semibold text-slate-900 text-sm">{row.vendor.name}</span>,
    },
    {
      key: 'totalOwed',
      header: 'Total Owed',
      align: 'right',
      render: (row) => <MoneyCell amount={row.totalOwed} />,
    },
    {
      key: 'totalPaid',
      header: 'Total Paid',
      align: 'right',
      render: (row) => <MoneyCell amount={row.totalPaid} muted />,
    },
    {
      key: 'pendingBalance',
      header: 'Pending Balance',
      align: 'right',
      render: (row) => (
        <MoneyCell amount={row.pendingBalance} className={row.pendingBalance > 0 ? 'text-danger-700' : ''} />
      ),
    },
    {
      key: '__actions',
      header: 'Actions',
      align: 'right',
      width: '8rem',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setPayingVendor(row.vendor)}>
          Pay
        </Button>
      ),
    },
  ]

  const logColumns = [
    {
      key: 'vendor',
      header: 'Vendor',
      render: (row) => <span className="text-sm font-medium text-slate-900">{row.vendor?.name || '—'}</span>,
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <MoneyCell amount={row.amount} /> },
    { key: 'paidAt', header: 'Date', render: (row) => <DateCell value={row.paidAt} /> },
    {
      key: 'method',
      header: 'Method',
      render: (row) => <Badge tone="neutral" size="sm">{row.method.replace('_', ' ')}</Badge>,
    },
    { key: 'note', header: 'Note', render: (row) => <span className="text-xs text-ink-subtle">{row.note || '—'}</span> },
  ]

  return (
    <>
      <PageBody>
        <PageHeader
          title="Vendor Payouts"
          description="What's owed to each vendor, what's been paid, and the log of past payouts."
        />

        {summary.isLoading ? (
          <PageSkeleton rows={3} />
        ) : summary.error ? (
          <ErrorState error={summary.error} onRetry={summary.refetch} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <Table
              columns={summaryColumns}
              data={summary.items}
              getRowKey={(row) => row.vendor.id}
              density="comfortable"
            />
          </div>
        )}

        <PageHeader title="Payout Log" description="Every recorded vendor payout, most recent first." />
        {log.isLoading && log.items.length === 0 ? (
          <PageSkeleton rows={3} />
        ) : log.error ? (
          <ErrorState error={log.error} onRetry={log.refetch} />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <Table
                columns={logColumns}
                data={log.items}
                getRowKey={(row) => row.id}
                density="comfortable"
                isLoading={log.isFetching}
              />
            </div>
            {log.totalItems > 0 && (
              <Pagination
                page={log.page}
                totalPages={log.totalPages}
                totalItems={log.totalItems}
                rowsPerPage={log.rowsPerPage}
                onPageChange={log.setPage}
                itemLabel="payouts"
              />
            )}
          </>
        )}
      </PageBody>

      {payingVendor && <PayForm vendor={payingVendor} onClose={() => setPayingVendor(null)} />}
    </>
  )
}
