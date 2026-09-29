import { useState } from 'react'
import { Button, Input, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import {
  COMMISSION_RULE_COLUMNS,
  SCOPE_ORDER,
} from '../../tableColumns/financeColumns'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useCommissionRulesController,
  useCommissionRuleWriteController,
} from '../../controllers/useFinanceController'

export function CommissionRulesPage() {
  const { data, isLoading, error, refetch } = useCommissionRulesController()
  const writer = useCommissionRuleWriteController()
  const [editingId, setEditingId] = useState(null)
  const [draftValue, setDraftValue] = useState('')

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

  const sorted = [...data.items].sort(
    (a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope),
  )

  function saveEdit(row) {
    const value = Number(draftValue)
    if (!Number.isFinite(value) || value < 0 || value > 100) return
    writer.run({ id: row.id, value })
    setEditingId(null)
  }

  const columnsWithEdit = [
    ...COMMISSION_RULE_COLUMNS,
    {
      key: '__edit',
      header: '',
      width: '9rem',
      align: 'right',
      render: (row) =>
        row.scope === 'vendor' && (
          <PermissionGate permission={ADMIN_PERMISSIONS.FINANCE_MANAGE}>
            {editingId === row.id ? (
              <div className="flex items-center justify-end gap-1.5">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="w-16 text-right"
                  size="sm"
                />
                <Button size="xs" onClick={() => saveEdit(row)} disabled={writer.isSubmitting}>
                  Save
                </Button>
              </div>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setEditingId(row.id)
                  setDraftValue(String(row.value))
                }}
              >
                Edit rate
              </Button>
            )}
          </PermissionGate>
        ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title="Commission rules"
        description="Each seller's commission rate, and the platform default that applies when a seller has none set."
      />

      <InlineAlert tone="warning" title="Changing a rate does not change existing orders">
        Commission is computed at settlement time from the seller&apos;s current rate. Editing a rate
        here affects orders settled from now on, not past settlements.
      </InlineAlert>

      <SectionCard
        title="Rules in resolution order"
        description="The number beside each scope is its priority — 1 is checked first"
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={columnsWithEdit}
          data={sorted}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}
