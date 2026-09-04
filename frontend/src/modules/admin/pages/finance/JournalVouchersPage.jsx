import { useMemo, useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { AccountingShell } from '../../components/finance/AccountingShell'
import { LedgerToolbar } from '../../components/finance/LedgerToolbar'
import { VoucherFormDrawer } from '../../components/finance/VoucherFormDrawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { VOUCHER_COLUMNS, VOUCHER_TABS } from '../../tableColumns/financeColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useAccountOptionsController,
  useJournalVoucherListController,
  useJournalVoucherWriteController,
} from '../../controllers/useFinanceController'

const POST = ADMIN_PERMISSIONS.ACCOUNTING_POST

export function JournalVouchersPage() {
  const list = useJournalVoucherListController()
  const options = useAccountOptionsController()
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const writer = useJournalVoucherWriteController({ onSaved: () => setEditing(null) })

  const columns = useMemo(
    () =>
      withRowActions(VOUCHER_COLUMNS, (row) => [
        { label: 'Edit', icon: 'edit', permission: POST, disabled: row.status === 'reversed', onSelect: () => setEditing(row) },
        { label: 'Post to ledger', icon: 'check', permission: POST, disabled: row.status !== 'draft', onSelect: () => writer.post.run({ id: row.id }) },
        { label: 'Reverse', icon: 'refresh', permission: POST, disabled: row.status !== 'posted', onSelect: () => setConfirming({ kind: 'reverse', row }) },
        { label: 'Delete draft', icon: 'delete', tone: 'danger', permission: POST, disabled: row.status !== 'draft', onSelect: () => setConfirming({ kind: 'delete', row }) },
      ]),
    [writer.post],
  )

  const reversing = confirming?.kind === 'reverse'
  const action = reversing ? writer.reverse : writer.remove

  return (
    <>
    <AccountingShell
      title="Journal vouchers"
      description="Manual double-entry postings. Every voucher must balance before it can be posted."
      controller={{ ...list, data: list.items }}
      actions={
        <PermissionGate permission={POST}>
          <Button size="control" icon="add" onClick={() => setEditing('new')}>
            New voucher
          </Button>
        </PermissionGate>
      }
      toolbar={
        <LedgerToolbar
          tabs={VOUCHER_TABS}
          controller={list}
          total={list.totalItems}
          searchPlaceholder="Voucher number, narration or author…"
        />
      }
    >
      {(items) => (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table
            className="rounded-none border-0"
            columns={columns}
            data={items}
            getRowKey={(row) => row.id}
            density="compact"
          />
        </div>
      )}
    </AccountingShell>

      {/* Keyed on the row so opening a different voucher remounts the form
          with that voucher's lines instead of resyncing through an effect. */}
      {editing && (
        <VoucherFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          isOpen
          onClose={() => setEditing(null)}
          voucher={editing === 'new' ? null : editing}
          accounts={options.data?.accounts || []}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={reversing ? `Reverse ${confirming?.row.number}?` : `Delete ${confirming?.row.number}?`}
        description={
          reversing
            ? 'A reversing entry backs the figures out of the ledger. The original voucher stays in the audit trail.'
            : 'A draft has never touched the ledger, so deleting it changes no balances.'
        }
        confirmLabel={reversing ? 'Reverse voucher' : 'Delete draft'}
        isSubmitting={action.isSubmitting}
        onConfirm={() => {
          action.run({ id: confirming.row.id })
          setConfirming(null)
        }}
      />
    </>
  )
}
