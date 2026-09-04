import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Textarea } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import {
  EvidenceGrid,
  PolicyChecklist,
  ReturnMetaRail,
} from '../../components/fulfilment/ReturnReview'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useReturnDetailController } from '../../controllers/useFulfilmentController'
import { REASON_LABELS, RETURN_STATUS_LABELS, RETURN_STATUS_TONE } from '../../tableColumns/fulfilmentColumns'

export function ReturnDetailPage() {
  const { returnId } = useParams()
  const { request, isLoading, error, refetch } = useReturnDetailController(returnId)
  const [note, setNote] = useState('')

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

  const decided = request.status !== 'awaiting_review'

  return (
    <PageBody>
      <PageHeader
        title={`Return ${request.id}`}
        trail={[{ label: request.id }]}
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.RETURNS_MANAGE}>
            <Button variant="dangerOutline" size="control" disabled={decided}>
              Reject
            </Button>
            <Button variant="secondary" size="control" disabled={decided}>
              Refund {formatMoney(request.value)}
            </Button>
            <Button size="control" icon="check" disabled={decided}>
              Issue replacement
            </Button>
          </PermissionGate>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={RETURN_STATUS_TONE[request.status]} dot>
            {RETURN_STATUS_LABELS[request.status]}
          </Badge>
          <Badge tone="neutral" size="sm">
            {REASON_LABELS[request.reason]}
          </Badge>
          <span className="tabular">{request.subOrderId}</span>
          <span className="text-border-strong">·</span>
          <span>Raised {request.raisedAt} by {request.buyer}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard
            title="What the buyer says"
            description="Photo evidence is mandatory — a request without it cannot be approved"
          >
            <div className="flex flex-col gap-4 px-4 py-4">
              <p className="text-xs leading-relaxed text-ink-muted">{request.buyerNote}</p>
              <EvidenceGrid evidence={request.evidence} />
            </div>
          </SectionCard>

          <SectionCard title="Decision" description="Rejecting requires a reason — it is sent to the buyer and written to the audit log">
            <div className="flex flex-col gap-3 px-4 py-4">
              <Textarea
                id="decision-note"
                rows={3}
                placeholder="Reason for the decision — visible to the buyer…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={decided}
              />
              <p className="text-2xs text-ink-faint">
                Approving a replacement reserves stock and creates a fresh sub-order. Approving a
                refund reverses this sub-order&rsquo;s Route transfer only.
              </p>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <PolicyChecklist policy={request.policy} reason={request.reason} />

          <ReturnMetaRail request={request} />
        </div>
      </div>
    </PageBody>
  )
}
