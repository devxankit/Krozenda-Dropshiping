import { useState } from 'react'
import { Button, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useDropshipMarginsController } from '../../controllers/useDropshippingController'
import { MARGIN_RULE_COLUMNS } from '../../tableColumns/dropshippingColumns'
import { MarginRuleModal } from '../../components/dropshipping/MarginRuleModal'

export function DropshippingMarginsPage() {
  const { data, isLoading, error, refetch, addRule } = useDropshipMarginsController()
  const [modalOpen, setModalOpen] = useState(false)

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

  return (
    <>
      <PageBody>
        <PageHeader
          title="Dropship Margin & Commission Rules"
          description="Admin-configurable commission rules enforcing resolution order hierarchy (PRD §6.5): Product → Vendor → Category → Company → Default Minimum."
          actions={
            <PermissionGate permission={ADMIN_PERMISSIONS.FINANCE_MANAGE}>
              <Button size="control" icon="add" onClick={() => setModalOpen(true)}>
                Add margin rule
              </Button>
            </PermissionGate>
          }
        />

        <InlineAlert tone="info" title="Commission Resolution Hierarchy">
          When an order is placed, the pricing engine evaluates rules from most specific to least specific.
          The resulting commission value is snapshotted onto the sub-order at checkout and never recomputed from live config.
        </InlineAlert>

        <SectionCard title="Active Resolution Rules" description="Centralized commission rules ordered by specificity hierarchy">
          <Table
            className="rounded-none border-0 border-t"
            columns={MARGIN_RULE_COLUMNS}
            data={data}
            getRowKey={(rule) => rule.id}
            density="compact"
          />
        </SectionCard>
      </PageBody>

      <MarginRuleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddRule={addRule}
      />
    </>
  )
}
