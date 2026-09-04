import { useMemo, useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { AccountingShell } from '../../components/finance/AccountingShell'
import { LedgerToolbar } from '../../components/finance/LedgerToolbar'
import { ExpenseFormDrawer } from '../../components/finance/ExpenseFormDrawer'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { EXPENSE_COLUMNS, EXPENSE_TABS } from '../../tableColumns/financeColumns'
import { withRowActions } from '../../tableColumns/rowActions'
import {
  useAccountOptionsController,
  useExpenseListController,
  useExpenseWriteController,
} from '../../controllers/useFinanceController'

const POST = ADMIN_PERMISSIONS.ACCOUNTING_POST

export function ExpensesPage() {
  const list = useExpenseListController()
  const options = useAccountOptionsController()
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const writer = useExpenseWriteController({ onSaved: () => setEditing(null) })

  const columns = useMemo(
    () =>
      withRowActions(EXPENSE_COLUMNS, (row) => [
        { label: 'Edit', icon: 'edit', permission: POST, onSelect: () => setEditing(row) },
        { label: 'Delete', icon: 'delete', tone: 'danger', permission: POST, onSelect: () => setConfirming(row) },
      ]),
    [],
  )

  return (
    <>
      <AccountingShell
        title="Expenses"
        description="Operating spend by category, and which of it carries a claimable input credit."
        controller={{ ...list, data: list.items }}
        actions={
          <PermissionGate permission={POST}>
            <Button size="control" icon="add" onClick={() => setEditing('new')}>
              Record expense
            </Button>
          </PermissionGate>
        }
        toolbar={
          <LedgerToolbar
            tabs={EXPENSE_TABS}
            controller={list}
            total={list.totalItems}
            searchPlaceholder="Category, payee or narration…"
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

      {editing && (
        <ExpenseFormDrawer
          key={editing === 'new' ? 'new' : editing.id}
          isOpen
          onClose={() => setEditing(null)}
          expense={editing === 'new' ? null : editing}
          categories={options.data?.expenseCategories || []}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Delete this expense?"
        description="Its ledger postings are backed out, so the P&L and balance sheet move with it."
        confirmLabel="Delete expense"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() => {
          writer.remove.run({ id: confirming.id })
          setConfirming(null)
        }}
      />
    </>
  )
}
