import { useState } from 'react'
import { Badge, Button, Textarea } from '../../../../components/ui'
import { Drawer } from '../../../admin/components/overlay/Drawer'
import { InlineAlert } from '../../../admin/components/feedback'
import { MoneyCell, StatusPill } from '../../../admin/components/display'
import { toast } from '../../../admin/stores/toastStore'
import { VENDOR_RETURN_STATUS_TONE } from '../../constants'

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="text-xs text-slate-900">{children}</span>
    </div>
  )
}

// What the seller is allowed to do here, and what they are not.
//
// They can record a recommendation with a note. They cannot approve, reject,
// refund or close the request — that is admin's, because approving a REFUND
// credits the buyer's wallet and a seller judging a claim against their own
// product is not a review. The copy says so plainly rather than leaving the
// seller to discover it when nothing happens.
// ReturnsPage keys this component by request id, so opening a different return
// REMOUNTS it and these initialisers run again. That is what keeps a note typed
// against one return from being submitted against another — without an effect
// that writes state on every render pass.
export function VendorReturnDrawer({ request, isOpen, onClose, controller }) {
  const [decision, setDecision] = useState(request?.sellerRecommendation?.decision ?? null)
  const [note, setNote] = useState(request?.sellerRecommendation?.note ?? '')

  if (!request) return null

  const isDecided = request.status !== 'PENDING'
  const existing = request.sellerRecommendation

  async function handleSubmit() {
    if (!decision) return
    try {
      await controller.recommend({ id: request.id, decision, note })
      toast.success('Recommendation sent', 'An admin makes the final decision.')
      onClose()
    } catch (err) {
      toast.error('Could not send', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={request.productName}
      description={`${request.requestType} · raised by ${request.customer.name || 'a buyer'}`}
      width="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="quiet" size="control" onClick={onClose}>
            Close
          </Button>
          {!isDecided && (
            <Button
              size="control"
              onClick={handleSubmit}
              disabled={!decision}
              isLoading={controller.isRecommending}
            >
              {existing ? 'Update recommendation' : 'Send recommendation'}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <StatusPill status={request.status} tones={VENDOR_RETURN_STATUS_TONE} size="sm" />
          </Field>
          <Field label="Refund value">
            {request.refundAmount ? <MoneyCell amount={request.refundAmount} compact /> : '—'}
          </Field>
          <Field label="Buyer">{request.customer.name || '—'}</Field>
          <Field label="Order">{request.orderId.slice(-8).toUpperCase()}</Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Buyer&rsquo;s reason</span>
          <p className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-slate-900">{request.reason}</p>
        </div>

        {request.photos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              Evidence ({request.photos.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {request.photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={url}
                    alt="Buyer evidence"
                    className="h-20 w-20 rounded-lg border border-border object-cover transition hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {isDecided ? (
          <InlineAlert
            tone={request.status === 'REJECTED' ? 'danger' : request.status === 'ACCEPTED' ? 'info' : 'success'}
            title={
              request.status === 'ACCEPTED'
                ? 'Admin approved this return — the item is on its way back to you'
                : request.status === 'APPROVED'
                  ? `Return completed (${request.requestType === 'REFUND' ? 'buyer refunded' : 'replacement order created'})`
                  : 'Admin rejected this request'
            }
          >
            {request.adminNote || 'No note was left.'}
          </InlineAlert>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div>
              <p className="text-xs font-semibold text-slate-900">Your recommendation</p>
              <p className="mt-0.5 text-2xs text-ink-subtle">
                Advisory — an admin reviews every return and makes the final call. Your note is what they read.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'APPROVE', label: 'Recommend approve', tone: 'emerald' },
                { value: 'REJECT', label: 'Recommend reject', tone: 'danger' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDecision(option.value)}
                  aria-pressed={decision === option.value}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    decision === option.value
                      ? option.value === 'APPROVE'
                        ? 'border-success-500 bg-success-50 text-success-700'
                        : 'border-danger-500 bg-danger-50 text-danger-700'
                      : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Textarea
              id="return-recommendation-note"
              label="Why?"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. item came back with the seal broken, or this SKU is not ours"
              description="Admin sees this alongside the buyer's reason."
            />

            {existing && (
              <p className="text-2xs text-ink-subtle">
                You recommended {existing.decision === 'APPROVE' ? 'approving' : 'rejecting'} this on{' '}
                {new Date(existing.at).toLocaleDateString('en-IN')}. Sending again replaces it.
              </p>
            )}

            {controller.recommendError && (
              <InlineAlert tone="danger" title="That did not go through">
                {controller.recommendError?.response?.data?.message || 'Try again in a moment.'}
              </InlineAlert>
            )}
          </div>
        )}

        {existing && isDecided && (
          <div className="flex flex-col gap-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">You recommended</span>
            <Badge tone={existing.decision === 'APPROVE' ? 'success' : 'danger'} size="sm">
              {existing.decision === 'APPROVE' ? 'Approve' : 'Reject'}
            </Badge>
            {existing.note && <p className="mt-1 text-xs text-ink-muted">{existing.note}</p>}
          </div>
        )}
      </div>
    </Drawer>
  )
}
