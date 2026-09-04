import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { BUYER_TYPE_LABELS, REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../constants'
import { IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

const ACCOUNT_TONE = Object.freeze({
  active: 'success',
  dormant: 'neutral',
  blocked: 'danger',
  suspended: 'danger',
  pending: 'warning',
  invited: 'brand',
})

const MODEL_LABELS = Object.freeze({
  marketplace: 'Marketplace',
  dropshipping: 'Dropshipping',
  own_stock: 'Own stock',
})

export const CUSTOMER_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Customer',
    sortable: true,
    render: (row) => (
      <PrimaryCell title={row.name} subtitle={row.email} to={adminPath.customerDetail(row.id)} />
    ),
  },
  {
    key: 'type',
    header: 'Type',
    width: '9rem',
    render: (row) => (
      <Badge tone={row.type === 'retail' ? 'neutral' : 'accent'} size="sm">
        {BUYER_TYPE_LABELS[row.type]}
      </Badge>
    ),
  },
  { key: 'city', header: 'City', width: '9rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'orders', header: 'Orders', width: '5.5rem', align: 'right', sortable: true, cellClassName: 'tabular' },
  {
    key: 'lifetimeValue',
    header: 'Lifetime value',
    width: '8.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.lifetimeValue} compact />,
  },
  {
    key: 'lastOrderAt',
    header: 'Last order',
    width: '8rem',
    render: (row) =>
      row.lastOrderAt ? (
        <span className="text-xs text-ink-muted">{row.lastOrderAt}</span>
      ) : (
        <span className="text-2xs text-ink-faint">never</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7rem',
    render: (row) => (
      <Badge tone={ACCOUNT_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])

export const CUSTOMER_FILTERS = Object.freeze([
  {
    key: 'type',
    label: 'Buyer type',
    options: Object.entries(BUYER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  },
])

export const CUSTOMER_TABS = Object.freeze([
  { id: 'all', label: 'All customers' },
  { id: 'retail', label: 'Retail (B2C)' },
  { id: 'b2b', label: 'B2B buyers' },
  { id: 'dormant', label: 'Dormant' },
  { id: 'blocked', label: 'Blocked' },
])

export const VENDOR_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Vendor',
    sortable: true,
    render: (row) => (
      <PrimaryCell
        title={row.name}
        subtitle={`${row.role} · ${row.city}`}
        to={adminPath.sellerDetail(row.id)}
      />
    ),
  },
  {
    key: 'model',
    header: 'Model',
    width: '8rem',
    render: (row) => (
      <span className="text-xs text-ink-muted">{MODEL_LABELS[row.model]}</span>
    ),
  },
  {
    key: 'gstin',
    header: 'GSTIN',
    width: '10rem',
    render: (row) =>
      row.gstin ? (
        <span className="tabular text-xs text-ink-muted">{row.gstin}</span>
      ) : (
        <span className="text-2xs text-ink-faint">not supplied</span>
      ),
  },
  { key: 'products', header: 'SKUs', width: '5.5rem', align: 'right', sortable: true, cellClassName: 'tabular' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.revenue} compact />,
  },
  {
    key: 'kycStatus',
    header: 'KYC',
    width: '9.5rem',
    render: (row) => (
      <StatusPill
        status={row.kycStatus}
        labels={REVIEW_STATUS_LABELS}
        tones={REVIEW_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'routeLinked',
    header: 'Payouts',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={row.routeLinked ? 'success' : 'warning'} size="sm" dot>
        {row.routeLinked ? 'Route linked' : 'Not linked'}
      </Badge>
    ),
  },
])

export const VENDOR_FILTERS = Object.freeze([
  {
    key: 'model',
    label: 'Business model',
    options: Object.entries(MODEL_LABELS).map(([value, label]) => ({ value, label })),
  },
  {
    key: 'kycStatus',
    label: 'KYC status',
    options: Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  },
])

export const VENDOR_TABS = Object.freeze([
  { id: 'all', label: 'All vendors' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'dropshipping', label: 'Dropshipping' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
])

export const KYC_QUEUE_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Application',
    width: '8.5rem',
    render: (row) => <IdCell id={row.id} to={adminPath.kycReview(row.id)} />,
  },
  {
    key: 'vendorName',
    header: 'Applicant',
    render: (row) => <PrimaryCell title={row.vendorName} subtitle={row.role} />,
  },
  { key: 'submittedAt', header: 'Submitted', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'waitingDays',
    header: 'Waiting',
    width: '6.5rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span
        className={`tabular text-xs ${row.waitingDays > 3 ? 'font-semibold text-warning-700' : 'text-ink-muted'}`}
      >
        {row.waitingDays === 0 ? 'today' : `${row.waitingDays}d`}
      </span>
    ),
  },
  {
    key: 'documentsApproved',
    header: 'Documents',
    width: '10rem',
    render: (row) => (
      <span className="flex items-center gap-2">
        <span className="flex gap-0.5">
          {Array.from({ length: row.documentsRequired }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 w-3 rounded-sm ${index < row.documentsApproved ? 'bg-success-500' : 'bg-border-strong'}`}
            />
          ))}
        </span>
        <span className="tabular text-2xs text-ink-faint">
          {row.documentsApproved}/{row.documentsRequired}
        </span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '10rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={REVIEW_STATUS_LABELS}
        tones={REVIEW_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const KYC_TABS = Object.freeze([
  { id: 'all', label: 'All applications' },
  { id: 'new', label: 'New' },
  { id: 'reviewing', label: 'In review' },
  { id: 'changes', label: 'Changes requested' },
  { id: 'overdue', label: 'Waiting over 3 days' },
])

export const POLICY_ACCEPTANCE_COLUMNS = Object.freeze([
  {
    key: 'party',
    header: 'Party',
    render: (row) => <PrimaryCell title={row.party} subtitle={row.partyType} />,
  },
  { key: 'policy', header: 'Policy', width: '13rem', cellClassName: 'text-xs text-slate-800' },
  {
    key: 'version',
    header: 'Version',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={row.current ? 'success' : 'neutral'} size="sm">
        {row.version}
        {!row.current && ' · superseded'}
      </Badge>
    ),
  },
  { key: 'acceptedAt', header: 'Accepted', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'ip',
    header: 'From IP',
    width: '9rem',
    render: (row) => <span className="tabular text-xs text-ink-muted">{row.ip}</span>,
  },
])

export const POLICY_ACCEPTANCE_TABS = Object.freeze([
  { id: 'all', label: 'All acceptances' },
  { id: 'current', label: 'Current version' },
  { id: 'superseded', label: 'Needs re-acceptance' },
])

export const STAFF_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Person',
    render: (row) => <PrimaryCell title={row.name} subtitle={row.email} />,
  },
  {
    key: 'role',
    header: 'Role',
    width: '11rem',
    render: (row) => (
      <Badge tone={row.roleId === 'super_admin' ? 'accent' : 'brand'} size="sm">
        {row.role}
      </Badge>
    ),
  },
  {
    key: 'twoFactor',
    header: 'Two-factor',
    width: '9rem',
    render: (row) => (
      <Badge tone={row.twoFactor ? 'success' : 'danger'} size="sm" dot>
        {row.twoFactor ? 'Enabled' : 'Not set up'}
      </Badge>
    ),
  },
  {
    key: 'lastSignInAt',
    header: 'Last sign-in',
    width: '11rem',
    render: (row) =>
      row.lastSignInAt ? (
        <span className="text-xs text-ink-muted">{row.lastSignInAt}</span>
      ) : (
        <span className="text-2xs text-ink-faint">never</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={ACCOUNT_TONE[row.status]} size="sm" dot>
        {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
      </Badge>
    ),
  },
])

export { MODEL_LABELS }
