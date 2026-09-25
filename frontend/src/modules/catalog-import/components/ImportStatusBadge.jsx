import { Badge } from '../../../components/ui'

// The four statuses the import screens talk about, plus the two transient
// ones the server uses while it is working.
const STATUS = {
  PROCESSING: { label: 'Processing', tone: 'neutral' },
  PENDING_REVIEW: { label: 'Pending Review', tone: 'warning' },
  APPROVING: { label: 'Importing', tone: 'brand' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'danger' },
}

export function ImportStatusBadge({ status }) {
  const s = STATUS[status] || { label: status, tone: 'neutral' }
  return (
    <Badge tone={s.tone} size="sm" dot>
      {s.label}
    </Badge>
  )
}
