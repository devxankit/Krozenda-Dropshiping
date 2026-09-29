import { Avatar, Badge, Icon } from '../../../components/ui'
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

export function getCustomerActionColumn(onToggleStatus) {
  return {
    key: '__status_action',
    header: 'Action',
    width: '7rem',
    render: (row) => (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleStatus(row)
        }}
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold ring-1 transition-colors ${
          row.status === 'blocked'
            ? 'bg-success-50 text-success-700 ring-success-200 hover:bg-success-100'
            : 'bg-danger-50 text-danger-700 ring-danger-200 hover:bg-danger-100'
        }`}
      >
        {row.status === 'blocked' ? 'Activate' : 'Block'}
      </button>
    ),
  }
}

export const CUSTOMER_TABS = Object.freeze([
  { id: 'all', label: 'All customers' },
  { id: 'top', label: 'Top 10 customers' },
  { id: 'blocked', label: 'Blocked' },
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

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const USER_MANAGEMENT_COLUMNS = Object.freeze([
  {
    key: 'sn',
    header: 'SN',
    width: '3.5rem',
    render: (row, index) => (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular">
        {index + 1}
      </span>
    ),
  },
  {
    key: 'staff',
    header: 'Staff Member',
    render: (row) => (
      <div className="flex items-center gap-3.5 py-1">
        <Avatar
          name={row.name}
          src={row.image}
          size="md"
          shape="circle"
          className="h-10 w-10 rounded-full aspect-square ring-2 ring-slate-100 shadow-sm shrink-0 object-cover"
        />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900 truncate hover:text-brand-600 transition-colors">
              {row.name}
            </span>
            {row.role === 'admin' && (
              <span className="inline-flex items-center rounded bg-accent-50 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700 ring-1 ring-accent-200/60">
                Admin
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 truncate">{row.email}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'mobileNumber',
    header: 'Mobile',
    width: '9.5rem',
    cellClassName: 'tabular whitespace-nowrap text-sm text-slate-700',
    render: (row) =>
      row.mobileNumber ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <Icon name="phone" className="h-3 w-3 text-slate-400 shrink-0" />
          <span className="tabular">{row.mobileNumber}</span>
        </span>
      ) : (
        <span className="text-xs text-slate-400 italic">—</span>
      ),
  },
  {
    key: 'role',
    header: 'Role',
    width: '9.5rem',
    render: (row) =>
      row.role === 'admin' ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200/70">
          <Icon name="roles" className="h-3 w-3 text-accent-500 shrink-0" />
          Admin
        </span>
      ) : row.roleName ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200/70">
          <Icon name="user" className="h-3 w-3 text-brand-500 shrink-0" />
          {row.roleName}
        </span>
      ) : (
        <span className="text-xs italic text-slate-400">No role</span>
      ),
  },
  {
    key: 'isActive',
    header: 'Status',
    width: '8rem',
    render: (row) =>
      row.isActive ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 ring-1 ring-success-200/70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
          </span>
          Active
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Inactive
        </span>
      ),
  },
  {
    key: 'createdAt',
    header: 'Joined',
    width: '9rem',
    cellClassName: 'whitespace-nowrap text-sm text-slate-600',
    render: (row) =>
      row.createdAt ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="tabular">{formatDate(row.createdAt)}</span>
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
  },
])

export { MODEL_LABELS }
