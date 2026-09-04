import { useState } from 'react'
import { Tabs } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { Textarea } from '../../../../components/ui'
import { ApprovalQueueList } from '../../components/catalog/ApprovalQueueList'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useApprovalQueueController,
  useApprovalWriteController,
} from '../../controllers/useCatalogController'
import { useAuthStore } from '../../../../lib/authStore'

const TABS = [
  { id: 'all', label: 'Everything' },
  { id: 'category', label: 'Categories' },
  { id: 'brand', label: 'Brands' },
  { id: 'product', label: 'Products' },
]

export function ApprovalsPage() {
  const { data, isLoading, error, refetch } = useApprovalQueueController()
  const [tab, setTab] = useState('all')
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const writer = useApprovalWriteController({ onDone: () => setRejecting(null) })
  const canApprove = useAuthStore((state) =>
    state.permissions.includes(ADMIN_PERMISSIONS.CATALOG_APPROVE),
  )

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

  const items = tab === 'all' ? data.items : data.items.filter((item) => item.kind === tab)

  return (
    <>
    <PageBody>
      <PageHeader
        title="Approval queue"
        description="Category, then brand, then product — a listing cannot go live until all three clear."
      />

      <InlineAlert tone="info" title="Order matters">
        An item marked <strong className="font-semibold">blocked</strong> is waiting on the approval
        above it in the chain. Approving the blocker releases everything behind it.
      </InlineAlert>

      <Tabs
        items={TABS.map((item) => ({ ...item, count: data.tabCounts[item.id] }))}
        activeId={tab}
        onChange={setTab}
      />

      <SectionCard title={`${items.length} waiting`}>
        <ApprovalQueueList
          items={items}
          canApprove={canApprove}
          isApproving={writer.approve.isSubmitting}
          onApprove={(item) => writer.approve.run({ id: item.id })}
          onReject={setRejecting}
        />
      </SectionCard>
    </PageBody>

      <ConfirmDialog
        isOpen={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name}?`}
        description="It leaves the queue and the submitter is told why. They can resubmit after fixing it."
        confirmLabel="Reject"
        isSubmitting={writer.reject.isSubmitting}
        onConfirm={() => writer.reject.run({ id: rejecting.id, reason })}
      >
        <Textarea
          id="approval-reject-reason"
          label="Reason"
          rows={3}
          required
          placeholder="Images do not meet the listing standard, category is wrong…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </ConfirmDialog>
    </>
  )
}
