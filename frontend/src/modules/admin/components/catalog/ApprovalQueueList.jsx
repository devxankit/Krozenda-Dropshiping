import { Badge, Button, Icon } from '../../../../components/ui'

const KIND_ICON = { category: 'categories', brand: 'brands', product: 'products' }

// The queue rows. Pulled out of ApprovalsPage so that screen stays the size
// of a screen once the approve/reject flow is attached to it.
export function ApprovalQueueList({ items, canApprove, onApprove, onReject, isApproving }) {
  return (
    <ul className="divide-y divide-border-subtle">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle">
            <Icon name={KIND_ICON[item.kind]} className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">
              {item.name}
            </span>
            <span className="block truncate text-2xs text-ink-faint">
              {item.context} · submitted by {item.submittedBy} on {item.submittedAt}
            </span>
          </span>

          {item.blockedBy ? (
            <Badge tone="neutral" size="sm" dot>
              Blocked by {item.blockedBy.toLowerCase()}
            </Badge>
          ) : (
            <Badge tone={item.waitingDays >= 3 ? 'warning' : 'neutral'} size="sm">
              {item.waitingDays === 0 ? 'Today' : `${item.waitingDays} days waiting`}
            </Badge>
          )}

          {canApprove && (
            <span className="flex shrink-0 gap-2">
              <Button
                variant="dangerOutline"
                size="sm"
                onClick={() => onReject(item)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                icon="check"
                disabled={Boolean(item.blockedBy) || isApproving}
                onClick={() => onApprove(item)}
              >
                Approve
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
