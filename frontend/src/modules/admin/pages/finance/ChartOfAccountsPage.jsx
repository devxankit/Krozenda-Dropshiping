import { useMemo, useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { AccountingShell } from '../../components/finance/AccountingShell'
import { AccountFormDrawer } from '../../components/finance/AccountFormDrawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { ACCOUNT_COLUMNS } from '../../tableColumns/financeColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useAccountWriteController,
  useChartOfAccountsController,
} from '../../controllers/useFinanceController'

const POST = ADMIN_PERMISSIONS.ACCOUNTING_POST

export function ChartOfAccountsPage() {
  const controller = useChartOfAccountsController()
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const writer = useAccountWriteController({ onSaved: () => setEditing(null) })

  const columns = useMemo(
    () =>
      withRowActions(ACCOUNT_COLUMNS, (row) => [
        { label: 'Edit', icon: 'edit', permission: POST, onSelect: () => setEditing(row) },
        {
          label: row.isActive === false ? 'Reactivate' : 'Deactivate',
          icon: row.isActive === false ? 'refresh' : 'archive',
          tone: row.isActive === false ? undefined : 'danger',
          permission: POST,
          // An account still holding a balance cannot be retired — the
          // fixture refuses it too, so this is a hint, not the enforcement.
          disabled: row.isActive !== false && row.balance !== 0,
          onSelect: () =>
            row.isActive === false
              ? writer.setActive.run({ code: row.code, isActive: true })
              : setConfirming(row),
        },
      ]),
    [writer.setActive],
  )

  return (
    <>
      <AccountingShell
        title="Chart of accounts"
        description="Every account a posting can land in, and what it holds today."
        controller={controller}
        actions={
          <PermissionGate permission={POST}>
            <Button size="control" icon="add" onClick={() => setEditing('new')}>
              New account
            </Button>
          </PermissionGate>
        }
      >
        {(data) => (
          <>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <Table
                className="rounded-none border-0"
                columns={columns}
                data={data.accounts}
                getRowKey={(row) => row.code}
                density="compact"
                stickyHeader
              />
            </div>
            <InlineAlert tone="info" title="Vendor payables are a sub-ledger">
              Account 2010 carries a balance per vendor, not one lump. That is what makes a
              per-vendor statement possible without a second source of truth.
            </InlineAlert>
          </>
        )}
      </AccountingShell>

      {editing && (
        <AccountFormDrawer
          key={editing === 'new' ? 'new' : editing.code}
          isOpen
          onClose={() => setEditing(null)}
          account={editing === 'new' ? null : editing}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={`Deactivate ${confirming?.code}?`}
        description="Nothing new can be posted to a deactivated account. History stays intact and it can be reactivated later."
        confirmLabel="Deactivate"
        isSubmitting={writer.setActive.isSubmitting}
        onConfirm={() => {
          writer.setActive.run({ code: confirming.code, isActive: false })
          setConfirming(null)
        }}
      />
    </>
  )
}
