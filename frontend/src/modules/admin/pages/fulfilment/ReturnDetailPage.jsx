import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Checkbox, Textarea } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import {
  EvidenceGrid,
  PolicyChecklist,
  ReturnMetaRail,
} from '../../components/fulfilment/ReturnReview'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useReturnDetailController, useReturnWriteController } from '../../controllers/useFulfilmentController'
import { REASON_LABELS, RETURN_STATUS_LABELS, RETURN_STATUS_TONE } from '../../tableColumns/fulfilmentColumns'

// Return lifecycle, as the server runs it (services/returnService.js):
//   awaiting_review → approve (pickup booked, no money) → item received →
//   complete (refund paid / replacement order created) — or reject at any
//   point before completion.
export function ReturnDetailPage() {
  const { returnId } = useParams()
  const { request, isLoading, error, refetch } = useReturnDetailController(returnId)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  // null = not touched yet, so the default follows the buyer's reason.
  const [requireItemBack, setRequireItemBack] = useState(null)
  const [restock, setRestock] = useState(null)
  const { decide, received, complete } = useReturnWriteController({ onDone: () => refetch?.() })

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

  const progress = request.progress || {}
  const isRefund = request.requestType !== 'REPLACEMENT'
  const pending = request.status === 'awaiting_review'
  const inProgress = request.status === 'approved'
  const finished = !pending && !inProgress
  // A missing item has nothing to send back; everything else must come back.
  const itemBack = requireItemBack ?? request.reason !== 'missing_product'
  // Damaged goods do not go back on sale by default.
  const putBackOnSale = restock ?? request.reason !== 'damaged'
  const busy = decide.isSubmitting || received.isSubmitting || complete.isSubmitting
  const destinationLabel =
    progress.refundDestination === 'RAZORPAY' ? 'the original payment method' : "the buyer's Krozenda wallet"
  const completeLabel = isRefund ? `Refund ${formatMoney(request.value)}` : 'Create replacement order'

  const onNoteChange = (event) => {
    setNote(event.target.value)
    if (noteError) setNoteError('')
  }

  const reject = () => {
    if (!note.trim()) {
      setNoteError('Write the reason for rejecting — the buyer sees it.')
      return
    }
    setNoteError('')
    decide.run({ id: request.id, decision: 'REJECTED', reason: note.trim() })
  }

  const approve = () => {
    setNoteError('')
    decide.run({ id: request.id, decision: 'APPROVED', reason: note.trim(), requireItemBack: itemBack, restock: false })
  }

  return (
    <PageBody>
      <PageHeader
        title={`Return ${request.id}`}
        trail={[{ label: request.id }]}
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.RETURNS_MANAGE}>
            {(pending || inProgress) && (
              <Button variant="dangerOutline" size="control" disabled={busy} onClick={reject}>
                Reject
              </Button>
            )}
            {pending && (
              <Button size="control" icon="check" disabled={busy} isLoading={decide.isSubmitting} onClick={approve}>
                {itemBack ? 'Approve & book pickup' : `Approve & ${isRefund ? 'refund now' : 'replace now'}`}
              </Button>
            )}
            {inProgress && progress.stage === 'awaiting_item' && (
              <Button
                variant="secondary"
                size="control"
                disabled={busy}
                isLoading={received.isSubmitting}
                onClick={() => received.run({ id: request.id })}
              >
                Mark item received
              </Button>
            )}
            {inProgress && progress.stage === 'ready_to_complete' && (
              <Button
                size="control"
                icon="check"
                disabled={busy}
                isLoading={complete.isSubmitting}
                onClick={() => complete.run({ id: request.id, restock: putBackOnSale })}
              >
                {completeLabel}
              </Button>
            )}
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
          <Badge tone={isRefund ? 'warning' : 'brand'} size="sm">
            {isRefund ? 'Buyer wants a refund' : 'Buyer wants a replacement'}
          </Badge>
          <span className="tabular">{request.subOrderId}</span>
          <span className="text-border-strong">·</span>
          <span>Raised {request.raisedAt} by {request.buyer}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="What the buyer says" description="The buyer's reason and any photos they attached">
            <div className="flex flex-col gap-4 px-4 py-4">
              <p className="text-xs leading-relaxed text-ink-muted">{request.buyerNote}</p>
              <EvidenceGrid evidence={request.evidence} />
            </div>
          </SectionCard>

          {pending && (
            <SectionCard title="Decision" description="Rejecting requires a reason — it is sent to the buyer">
              <div className="flex flex-col gap-3 px-4 py-4">
                <Textarea
                  id="decision-note"
                  rows={3}
                  placeholder="Note for the buyer (required to reject)…"
                  value={note}
                  onChange={onNoteChange}
                  error={noteError || undefined}
                />
                <Checkbox
                  id="require-item-back"
                  label="The buyer must send the item back"
                  description="Books a courier pickup when the order shipped by courier. Untick for a missing item — the request then completes straight away."
                  checked={itemBack}
                  onChange={(event) => setRequireItemBack(event.target.checked)}
                />
                <p className="text-2xs text-ink-faint">
                  {itemBack
                    ? `Approving books the pickup. ${isRefund ? `${formatMoney(request.value)} goes to ${destinationLabel}` : 'The replacement order is created'} once the item is back.`
                    : `Approving ${isRefund ? `refunds ${formatMoney(request.value)} to ${destinationLabel}` : 'creates the replacement order'} immediately.`}
                </p>
              </div>
            </SectionCard>
          )}

          {inProgress && (
            <SectionCard
              title="Return in progress"
              description={isRefund ? `Refund goes to ${destinationLabel}` : 'A free replacement order is created on completion'}
            >
              <div className="flex flex-col gap-3 px-4 py-4 text-xs">
                {progress.pickupMode === 'COURIER' && (
                  <InlineAlert tone="info" title="Courier pickup booked">
                    {progress.pickupCourier ? `${progress.pickupCourier} · ` : ''}
                    {progress.pickupAwb ? `AWB ${progress.pickupAwb} · ` : ''}
                    Status: {(progress.pickupStatus || 'requested').replace(/_/g, ' ').toLowerCase()}. It is marked
                    received automatically when the courier delivers it back.
                  </InlineAlert>
                )}
                {progress.pickupMode === 'MANUAL' && !progress.itemReceivedAt && (
                  <InlineAlert tone="warning" title="Collect the item by hand">
                    {progress.pickupError || 'No courier pickup was booked for this return.'} Mark it received once it
                    is back.
                  </InlineAlert>
                )}
                {progress.stage === 'ready_to_complete' && (
                  <>
                    <p className="text-ink-muted">
                      {progress.itemReceivedAt
                        ? 'The item is back. Inspect it, then complete the return.'
                        : 'Nothing has to come back for this return. Complete it to pay out.'}
                    </p>
                    {progress.pickupMode !== 'NOT_REQUIRED' && (
                      <Checkbox
                        id="restock"
                        label="Put the returned units back on sale"
                        description="Only if the item is unused and fit to sell. Leave unticked for damaged goods."
                        checked={putBackOnSale}
                        onChange={(event) => setRestock(event.target.checked)}
                      />
                    )}
                  </>
                )}
                <Textarea
                  id="decision-note"
                  rows={2}
                  placeholder="Reason, if rejecting (e.g. item came back used)…"
                  value={note}
                  onChange={onNoteChange}
                  error={noteError || undefined}
                />
              </div>
            </SectionCard>
          )}

          {finished && request.status !== 'rejected' && (
            <SectionCard title="Outcome">
              <div className="flex flex-col gap-2 px-4 py-4 text-xs text-ink-muted">
                {isRefund ? (
                  <p>
                    {formatMoney(request.value)} refunded to {destinationLabel}
                    {progress.razorpayRefundId ? ` (Razorpay ${progress.razorpayRefundId})` : ''}.
                  </p>
                ) : progress.replacementOrderId ? (
                  <p>
                    Replacement order{' '}
                    <Link
                      className="font-semibold text-brand-700 underline"
                      to={adminPath.orderDetail(progress.replacementOrderId)}
                    >
                      #{progress.replacementOrderId.slice(-8).toUpperCase()}
                    </Link>{' '}
                    created — the seller ships it like any order.
                  </p>
                ) : (
                  <p>Replacement issued.</p>
                )}
                {progress.pickupMode !== 'NOT_REQUIRED' && (
                  <p>{progress.restocked ? 'Returned units were put back on sale.' : 'Returned units were not restocked.'}</p>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <PolicyChecklist policy={request.policy} reason={request.reason} />

          <ReturnMetaRail request={request} />
        </div>
      </div>
    </PageBody>
  )
}
