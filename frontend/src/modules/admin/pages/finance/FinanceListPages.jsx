import { useMemo, useState } from 'react'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useRefundListController,
  useRefundWriteController,
  useTransactionListController,
  useTransactionWriteController,
} from '../../controllers/useFinanceController'
import * as columns from '../../tableColumns/financeColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import { downloadTableCsv } from '../../lib/exportCsv'

const MANAGE = ADMIN_PERMISSIONS.FINANCE_MANAGE

export function TransactionsPage() {
  const list = useTransactionListController()
  const writer = useTransactionWriteController()
  const unreconciled = list.tabCounts.unreconciled || 0

  const cols = useMemo(
    () =>
      withRowActions(columns.TRANSACTION_COLUMNS, (row) => [
        {
          label: row.reconciled ? 'Mark unreconciled' : 'Mark reconciled',
          icon: row.reconciled ? 'close' : 'check',
          permission: MANAGE,
          onSelect: () => writer.reconcile.run({ id: row.id, reconciled: !row.reconciled }),
        },
      ]),
    [writer.reconcile],
  )

  return (
    <ListScreen
      title="Transactions"
      description="Every Razorpay capture, its gateway fee, and whether it has been matched to a settlement."
      actions={<ExportMenu onExport={() => downloadTableCsv('transactions.csv', columns.TRANSACTION_COLUMNS, list.items)} />}
      banner={
        unreconciled > 0 && (
          <InlineAlert tone="warning" title={`${unreconciled} payments are not reconciled`}>
            A capture is matched when its payout appears in the bank statement. Unmatched
            payments block the period from being closed.
          </InlineAlert>
        )
      }
      controller={list}
      columns={cols}
      filters={columns.TRANSACTION_FILTERS}
      tabs={columns.TRANSACTION_TABS}
      searchPlaceholder="Payment reference, order or buyer…"
      itemLabel="payments"
      emptyIcon="money"
      emptyTitle="No payments in this view"
      selectable
      bulkLabel="payments selected"
      bulkActions={[
        {
          label: 'Mark reconciled',
          icon: 'check',
          onClick: () => {
            writer.reconcileMany.run({ ids: list.selectedKeys })
            list.setSelectedKeys([])
          },
        },
      ]}
    />
  )
}

export function RefundsPage() {
  const list = useRefundListController()
  const [declining, setDeclining] = useState(null)
  const [reason, setReason] = useState('')
  const writer = useRefundWriteController({ onDone: () => setDeclining(null) })
  const open = list.tabCounts.open || 0

  const cols = useMemo(
    () =>
      withRowActions(columns.REFUND_COLUMNS, (row) => [
        {
          label: 'Process refund',
          icon: 'check',
          permission: MANAGE,
          disabled: row.status === 'completed' || row.status === 'declined',
          onSelect: () => writer.process.run({ id: row.id }),
        },
        {
          label: 'Decline',
          icon: 'close',
          tone: 'danger',
          permission: MANAGE,
          disabled: row.status === 'completed',
          onSelect: () => setDeclining(row),
        },
      ]),
    [writer.process],
  )

  return (
    <>
      <ListScreen
        title="Refunds"
        description="Full and partial refunds, and whether the vendor's Route transfer has been reversed."
        actions={<ExportMenu onExport={() => downloadTableCsv('refunds.csv', columns.REFUND_COLUMNS, list.items)} />}
        banner={
          open > 0 && (
            <InlineAlert tone="warning" title={`${open} refunds are still open`}>
              A partial refund reverses only that sub-order&rsquo;s transfer. Until the reversal
              lands, the vendor ledger still shows money they are no longer owed.
            </InlineAlert>
          )
        }
        controller={list}
        columns={cols}
        tabs={columns.REFUND_TABS}
        searchPlaceholder="Refund reference, sub-order or buyer…"
        itemLabel="refunds"
        emptyIcon="returns"
        emptyTitle="No refunds in this view"
      />

      <ConfirmDialog
        isOpen={Boolean(declining)}
        onClose={() => setDeclining(null)}
        title="Decline this refund?"
        description="The buyer is told why. Nothing is paid back and the vendor transfer stands."
        confirmLabel="Decline refund"
        isSubmitting={writer.reject.isSubmitting}
        onConfirm={() => writer.reject.run({ id: declining.id, reason })}
      >
        <input
          id="decline-reason"
          placeholder="Reason the buyer will see"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </ConfirmDialog>
    </>
  )
}
