import { useState } from 'react'
import { Button, Input, Modal, Pagination, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { MoneyCell, DateCell } from '../../components/display'
import { usePendingCodController, useRecordCodRemittanceController } from '../../controllers/useAccountsController'

// Delivered Cash-on-Delivery orders whose cash the courier has not handed over yet. The courier collects
// at the door, so until the cash reaches Krozenda the order is unpaid on the books and the seller's line
// is not settleable (Business Rules > "Wait for COD cash"). "Mark received" records that the money
// arrived: the order becomes PAID and the sale, commission and platform fee post to the ledger.

function RemitForm({ order, onClose }) {
  const [reference, setReference] = useState('')
  const remit = useRecordCodRemittanceController({ onSaved: onClose })

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Cash received — order ${order.orderNumber}`}
      description="Confirm only once the courier's remittance for this order has reached your bank."
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose} disabled={remit.isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="control"
            isLoading={remit.isSubmitting}
            onClick={() => remit.run({ orderId: order.orderId, reference: reference.trim() })}
          >
            Mark received
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
          <span className="text-ink-subtle">Cash to receive</span>
          <MoneyCell amount={order.amount} />
        </div>
        <Input
          id="cod-reference"
          label="Courier remittance reference (optional)"
          placeholder="UTR / remittance ID"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
    </Modal>
  )
}

export function CodPendingSection({ switcher }) {
  const list = usePendingCodController()
  const [selected, setSelected] = useState(null)

  const columns = [
    {
      key: 'orderNumber',
      header: 'Order',
      render: (row) => <span className="tabular text-sm font-semibold text-slate-900">{row.orderNumber}</span>,
    },
    { key: 'buyer', header: 'Buyer', render: (row) => <span className="text-xs text-slate-700">{row.buyer || '—'}</span> },
    { key: 'amount', header: 'Cash to receive', align: 'right', render: (row) => <MoneyCell amount={row.amount} /> },
    { key: 'sellers', header: 'Sellers', align: 'right', render: (row) => <span className="tabular text-xs">{row.sellers}</span> },
    { key: 'deliveredAt', header: 'Delivered', render: (row) => <DateCell value={row.deliveredAt} /> },
    {
      key: '__action',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => setSelected(row)}>
          Mark received
        </Button>
      ),
    },
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
          title="COD cash to collect"
          description="Delivered Cash-on-Delivery orders waiting for the courier's remittance. Sellers are paid for these only after you mark the cash as received."
        />

        {switcher}

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
              {list.items.length === 0 && !list.isFetching && (
                <p className="px-4 py-6 text-center text-xs text-ink-subtle">
                  No delivered COD orders are waiting for cash. 🎉
                </p>
              )}
            </div>
            {list.totalItems > 0 && (
              <Pagination
                page={list.page}
                totalPages={list.totalPages}
                totalItems={list.totalItems}
                rowsPerPage={list.rowsPerPage}
                onPageChange={list.setPage}
                itemLabel="orders"
              />
            )}
          </>
        )}
      </PageBody>

      {selected && <RemitForm order={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
