import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import {
  BATCH_LINE_COLUMNS,
  BatchHeaderMeta,
  BatchMoneyRail,
} from '../../components/finance/SettlementPanels'
import { SettlementDecision } from '../../components/finance/SettlementDecisionDialogs'
import { ADMIN_PERMISSIONS, SETTLEMENT_STATUS } from '../../constants'
import {
  useSettlementBatchController,
  useSettlementWriteController,
} from '../../controllers/useFinanceController'
import { formatMoney } from '../../lib/format'

// Maker–checker: the nightly job prepares the batch, a second person releases
// it with a two-factor code. This screen is where that second person stands.
export function SettlementBatchPage() {
  const { batchId } = useParams()
  const { data: batch, isLoading, error, refetch } = useSettlementBatchController(batchId)
  const [deciding, setDeciding] = useState(null)
  const writer = useSettlementWriteController({ onDone: () => setDeciding(null) })

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

  const awaiting = batch.status === SETTLEMENT_STATUS.AWAITING_APPROVAL

  return (
    <PageBody>
      <PageHeader
        title={`Batch ${batch.id}`}
        trail={[{ label: batch.id }]}
        description={`${batch.vendor} · ${batch.subOrderCount} sub-orders scheduled for ${batch.scheduledFor}`}
        actions={
          <PermissionGate
            permission={ADMIN_PERMISSIONS.PAYOUT_APPROVE}
            fallback={
              <Button variant="secondary" size="control" disabled>
                Approval needs a Super Admin
              </Button>
            }
          >
            <Button
              variant="dangerOutline"
              size="control"
              disabled={!awaiting}
              onClick={() => setDeciding('reject')}
            >
              Reject batch
            </Button>
            <Button
              size="control"
              icon="check"
              disabled={!awaiting}
              onClick={() => setDeciding('release')}
            >
              Approve and release
            </Button>
          </PermissionGate>
        }
      >
        <BatchHeaderMeta batch={batch} />
      </PageHeader>

      {awaiting && (
        <InlineAlert tone="warning" title="Maker–checker approval required">
          This batch was prepared by the automated payout job. Releasing it moves{' '}
          <strong className="font-semibold">{formatMoney(batch.net)}</strong> out of the platform
          account and cannot be undone from here — a failed or reversed payout has to come back
          through a RazorpayX webhook.
        </InlineAlert>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SectionCard
          title="Sub-orders in this batch"
          description="Each line became eligible 30 days after delivery"
        >
          <Table
            className="rounded-none border-0 border-t"
            columns={BATCH_LINE_COLUMNS}
            data={batch.lines}
            getRowKey={(row) => row.subOrderId}
            density="compact"
          />
        </SectionCard>

        <BatchMoneyRail batch={batch} />
      </div>

      <SettlementDecision
        deciding={deciding}
        onClose={() => setDeciding(null)}
        batch={batch}
        writer={writer}
      />
    </PageBody>
  )
}
