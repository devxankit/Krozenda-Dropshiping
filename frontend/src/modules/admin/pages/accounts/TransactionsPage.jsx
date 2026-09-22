import { useState } from 'react'
import { Badge, Button, Icon, Input, Modal, Pagination, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { MoneyCell, DateCell } from '../../components/display'
import { useCreateTransactionController, useTransactionsController } from '../../controllers/useAccountsController'

// Accounts MVP — gateway transactions. Deliberately separate from the
// existing Accounting module's transaction ledger: this is a simple log of
// settlements into, and refunds out of, the gateway account against an
// order — no COD-remittance handling, no reconciliation flags.

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'SETTLEMENT', label: 'Settlement' },
  { value: 'REFUND', label: 'Refund' },
]

const TYPE_TONE = { SETTLEMENT: 'success', REFUND: 'danger' }

function AddTransactionForm({ onClose }) {
  const [orderId, setOrderId] = useState('')
  const [type, setType] = useState('SETTLEMENT')
  const [amount, setAmount] = useState('')
  const [gateway, setGateway] = useState('RAZORPAY')
  const [referenceId, setReferenceId] = useState('')
  const [note, setNote] = useState('')

  const create = useCreateTransactionController({ onSaved: onClose })

  const canSubmit = orderId.trim() && amount && Number(amount) > 0

  const submit = () => {
    if (!canSubmit) return
    create.run({
      order: orderId.trim(),
      type,
      amount: Number(amount),
      gateway,
      referenceId: referenceId.trim(),
      note,
    })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add transaction"
      description="Records a gateway settlement or refund against an order."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={create.isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="control" onClick={submit} isLoading={create.isSubmitting} disabled={!canSubmit}>
            Add transaction
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input id="txn-order" label="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
        <Select
          id="txn-type"
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[
            { value: 'SETTLEMENT', label: 'Settlement' },
            { value: 'REFUND', label: 'Refund' },
          ]}
        />
        <Input
          id="txn-amount"
          label="Amount (₹)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Input id="txn-gateway" label="Gateway" value={gateway} onChange={(e) => setGateway(e.target.value)} />
        <Input
          id="txn-reference"
          label="Reference ID (optional)"
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
        />
        <Input id="txn-note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  )
}

export function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const list = useTransactionsController({
    type: typeFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  const columns = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <span className="tabular font-semibold text-slate-900 text-sm">
          {row.order ? `#${row.order.id.slice(-8).toUpperCase()}` : '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge tone={TYPE_TONE[row.type] || 'neutral'} dot size="sm">
          {row.type}
        </Badge>
      ),
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <MoneyCell amount={row.amount} /> },
    { key: 'gateway', header: 'Gateway', render: (row) => <span className="text-xs text-ink-subtle">{row.gateway}</span> },
    {
      key: 'referenceId',
      header: 'Reference',
      render: (row) => <span className="text-xs text-ink-subtle">{row.referenceId || '—'}</span>,
    },
    { key: 'occurredAt', header: 'Date', render: (row) => <DateCell value={row.occurredAt} /> },
  ]

  if (list.isLoading && list.items.length === 0 && !list.error) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
      </PageBody>
    )
  }

  return (
    <>
      <PageBody>
        <PageHeader
          title="Gateway Transactions"
          description="Money settled into, or refunded out of, the payment gateway account."
          actions={
            <Button variant="primary" size="control" onClick={() => setIsAdding(true)}>
              <Icon name="add" className="h-3.5 w-3.5" />
              <span>Add transaction</span>
            </Button>
          }
        />

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:gap-4">
          <Select
            id="txn-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={TYPE_OPTIONS}
            size="control"
            containerClassName="w-full sm:w-44"
          />
          <div className="flex items-center gap-2">
            <Input type="date" size="control" value={startDate} onChange={(e) => setStartDate(e.target.value)} containerClassName="w-40" />
            <span className="text-xs text-ink-subtle">to</span>
            <Input type="date" size="control" value={endDate} onChange={(e) => setEndDate(e.target.value)} containerClassName="w-40" />
          </div>
        </div>

        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <Table
                columns={columns}
                data={list.items}
                getRowKey={(row) => row.id}
                density="comfortable"
                isLoading={list.isFetching}
              />
            </div>
            {list.totalItems > 0 && (
              <Pagination
                page={list.page}
                totalPages={list.totalPages}
                totalItems={list.totalItems}
                rowsPerPage={list.rowsPerPage}
                onPageChange={list.setPage}
                itemLabel="transactions"
              />
            )}
          </>
        )}
      </PageBody>

      {isAdding && <AddTransactionForm onClose={() => setIsAdding(false)} />}
    </>
  )
}
