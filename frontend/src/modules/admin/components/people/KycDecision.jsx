import { Button } from '../../../../components/ui'
import { REVIEW_STATUS } from '../../constants'
import { SectionCard } from '../display'

// Rejecting requires a reason. It is sent to the seller and written to the
// audit log, which is why the field is mandatory rather than encouraged.
export function DecisionStrip({ note, onNoteChange, disabled, onApprove, onReject }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
          Decision
        </span>
        <span className="text-2xs text-ink-faint">
          Rejecting requires a reason — it is sent to the seller and written to the audit log
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <textarea
          rows={2}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={disabled}
          placeholder="Reason for rejection — visible to the seller…"
          className="min-w-64 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-xs text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex w-44 flex-col gap-2">
          <Button size="control" icon="check" disabled={disabled} onClick={onApprove} className="w-full">
            Approve document
          </Button>
          <Button
            variant="dangerOutline"
            size="control"
            disabled={disabled || note.trim().length === 0}
            onClick={onReject}
            className="w-full"
          >
            Reject document
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ReviewProgress({ documents }) {
  const required = documents.filter((document) => document.required)
  const approved = required.filter((d) => d.status === REVIEW_STATUS.APPROVED).length
  const rejected = required.filter((d) => d.status === REVIEW_STATUS.REJECTED).length

  return (
    <SectionCard
      title="Review progress"
      actions={
        <span className="tabular text-xs text-ink-subtle">
          {approved} of {required.length} required
        </span>
      }
    >
      <div className="px-4 py-3.5">
        <div className="flex gap-1">
          {required.map((document) => (
            <span
              key={document.id}
              className={`h-1.5 flex-1 rounded-full ${
                document.status === REVIEW_STATUS.APPROVED
                  ? 'bg-success-500'
                  : document.status === REVIEW_STATUS.REJECTED
                    ? 'bg-danger-500'
                    : document.status === REVIEW_STATUS.REVIEWING
                      ? 'bg-warning-500'
                      : 'bg-border-strong'
              }`}
            />
          ))}
        </div>
        <p className="mt-2.5 text-2xs leading-relaxed text-ink-subtle">
          {rejected > 0
            ? 'The seller cannot go live until every rejected document is resubmitted and approved.'
            : approved === required.length
              ? 'Every required document is approved. Approving the seller creates their Razorpay Route linked account.'
              : 'Approve the remaining documents to unblock this seller.'}
        </p>
      </div>
    </SectionCard>
  )
}
