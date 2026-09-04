import { Badge } from '../../../components/ui'
import { PrimaryCell } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

const SEVERITY_TONE = Object.freeze({ info: 'neutral', notable: 'warning', critical: 'danger' })

const PRIORITY_TONE = Object.freeze({
  low: 'neutral',
  normal: 'brand',
  high: 'warning',
  urgent: 'danger',
})

const TICKET_TONE = Object.freeze({
  open: 'warning',
  waiting: 'brand',
  resolved: 'success',
  closed: 'neutral',
})

export const AUDIT_COLUMNS = Object.freeze([
  { key: 'at', header: 'When', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'actor',
    header: 'Who',
    width: '13rem',
    render: (row) => <PrimaryCell title={row.actor} subtitle={row.actorRole} />,
  },
  {
    key: 'action',
    header: 'Action',
    render: (row) => (
      <span className="block min-w-0">
        <span className="tabular block truncate text-xs font-semibold text-slate-900">
          {row.action}
        </span>
        <span className="block truncate text-2xs text-ink-faint">
          {row.entity} · {row.entityId}
        </span>
      </span>
    ),
  },
  {
    // A before/after pair is the whole point of an audit log — a row that says
    // only "settings updated" is not evidence of anything.
    key: 'before',
    header: 'Change',
    width: '16rem',
    render: (row) =>
      row.before || row.after ? (
        <span className="flex flex-col gap-0.5">
          {row.before && (
            <span className="tabular truncate text-2xs text-danger-700">− {row.before}</span>
          )}
          {row.after && (
            <span className="tabular truncate text-2xs text-success-700">+ {row.after}</span>
          )}
        </span>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  {
    key: 'ip',
    header: 'From',
    width: '8.5rem',
    render: (row) => <span className="tabular text-2xs text-ink-muted">{row.ip}</span>,
  },
  {
    key: 'severity',
    header: 'Severity',
    width: '7rem',
    render: (row) => (
      <Badge tone={SEVERITY_TONE[row.severity]} size="sm" dot={row.severity !== 'info'}>
        {row.severity.charAt(0).toUpperCase() + row.severity.slice(1)}
      </Badge>
    ),
  },
])

export const AUDIT_FILTERS = Object.freeze([
  {
    key: 'severity',
    label: 'Severity',
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'notable', label: 'Notable' },
      { value: 'info', label: 'Info' },
    ],
  },
])

export const AUDIT_TABS = Object.freeze([
  { id: 'all', label: 'Everything' },
  { id: 'critical', label: 'Critical' },
  { id: 'finance', label: 'Money & rules' },
  { id: 'access', label: 'Access' },
])

export const TICKET_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Ticket',
    width: '8rem',
    render: (row) => <span className="tabular text-xs font-semibold text-brand-700">{row.id}</span>,
  },
  {
    key: 'subject',
    header: 'Subject',
    render: (row) => (
      <PrimaryCell title={row.subject} subtitle={`${row.raisedBy} · ${row.category}`} />
    ),
  },
  {
    key: 'party',
    header: 'Raised by',
    width: '7rem',
    render: (row) => (
      <Badge tone={row.party === 'seller' ? 'accent' : 'neutral'} size="sm">
        {row.party === 'seller' ? 'Seller' : 'Buyer'}
      </Badge>
    ),
  },
  {
    key: 'ageHours',
    header: 'Age',
    width: '6rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span
        className={`tabular text-xs ${row.ageHours > 24 && row.status === 'open' ? 'font-semibold text-warning-700' : 'text-ink-muted'}`}
      >
        {row.ageHours < 24 ? `${row.ageHours}h` : `${Math.round(row.ageHours / 24)}d`}
      </span>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    width: '7rem',
    render: (row) => (
      <Badge tone={PRIORITY_TONE[row.priority]} size="sm" dot={row.priority !== 'low'}>
        {row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'owner',
    header: 'Owner',
    width: '11rem',
    render: (row) =>
      row.owner ? (
        <span className="text-xs text-ink-muted">{row.owner}</span>
      ) : (
        <Badge tone="warning" size="sm" dot>
          Unassigned
        </Badge>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={TICKET_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])

export const TICKET_FILTERS = Object.freeze([
  {
    key: 'party',
    label: 'Raised by',
    options: [
      { value: 'buyer', label: 'Buyer' },
      { value: 'seller', label: 'Seller' },
    ],
  },
])

export const TICKET_TABS = Object.freeze([
  { id: 'all', label: 'All tickets' },
  { id: 'open', label: 'Open' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'urgent', label: 'Needs attention' },
  { id: 'resolved', label: 'Resolved' },
])

const BACKUP_TONE = Object.freeze({ success: 'success', failed: 'danger', running: 'brand' })

export const SLAB_COLUMNS = Object.freeze([
  {
    key: 'rate',
    header: 'Rate',
    width: '6rem',
    render: (row) => <span className="tabular font-semibold text-slate-900">{row.rate}%</span>,
  },
  { key: 'label', header: 'Slab', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'productCount',
    header: 'Products',
    width: '9rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">
        {row.productCount.toLocaleString('en-IN')}
      </span>
    ),
  },
])

export const POLICY_COLUMNS = Object.freeze([
  { key: 'name', header: 'Policy', cellClassName: 'text-xs font-semibold text-slate-900' },
  {
    key: 'version',
    header: 'Version',
    width: '6.5rem',
    render: (row) => <span className="tabular text-xs text-slate-800">{row.version}</span>,
  },
  { key: 'effectiveFrom', header: 'Effective', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'acceptedBy',
    header: 'Accepted',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">{row.acceptedBy.toLocaleString('en-IN')}</span>
    ),
  },
  {
    key: 'pendingAcceptance',
    header: 'Pending',
    width: '9rem',
    align: 'right',
    render: (row) =>
      row.pendingAcceptance ? (
        <Badge tone={row.requiresReacceptance ? 'warning' : 'neutral'} size="sm" dot={row.requiresReacceptance}>
          {row.pendingAcceptance.toLocaleString('en-IN')} outstanding
        </Badge>
      ) : (
        <span className="text-2xs text-ink-faint">none</span>
      ),
  },
])

export const BACKUP_COLUMNS = Object.freeze([
  { key: 'startedAt', header: 'Started', width: '13rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'destination', header: 'Destination', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'sizeMb',
    header: 'Size',
    width: '7rem',
    align: 'right',
    render: (row) =>
      row.sizeMb ? (
        <span className="tabular text-xs text-slate-800">{(row.sizeMb / 1024).toFixed(2)} GB</span>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  {
    key: 'durationSeconds',
    header: 'Duration',
    width: '7rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">
        {Math.floor(row.durationSeconds / 60)}m {row.durationSeconds % 60}s
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Result',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={BACKUP_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])
