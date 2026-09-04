import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import {
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  SETTLEMENT_STATUS,
  SETTLEMENT_STATUS_LABELS,
  SETTLEMENT_STATUS_TONE,
} from '../constants'
import { IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

const REFUND_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
})
const REFUND_STATUS_TONE = Object.freeze({
  pending: 'warning',
  processing: 'brand',
  completed: 'success',
  failed: 'danger',
})

const POST_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  posted: 'Posted',
  reversed: 'Reversed',
  paid: 'Paid',
})
const POST_STATUS_TONE = Object.freeze({
  draft: 'neutral',
  posted: 'brand',
  reversed: 'danger',
  paid: 'success',
})

export const TRANSACTION_COLUMNS = Object.freeze([
  {
    key: 'reference',
    header: 'Payment',
    width: '13rem',
    render: (row) => (
      <PrimaryCell title={row.reference} subtitle={row.orderId} to={adminPath.orderDetail(row.orderId)} />
    ),
  },
  { key: 'buyer', header: 'Buyer', cellClassName: 'text-xs text-ink-muted' },
  { key: 'method', header: 'Method', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'capturedAt', header: 'Captured', width: '10rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'gross',
    header: 'Gross',
    width: '7rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.gross} />,
  },
  {
    key: 'fee',
    header: 'Gateway fee',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.fee} muted />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={PAYMENT_STATUS_LABELS}
        tones={PAYMENT_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'reconciled',
    header: 'Reconciled',
    width: '8rem',
    render: (row) => (
      <Badge tone={row.reconciled ? 'success' : 'warning'} size="sm" dot>
        {row.reconciled ? 'Matched' : 'Unmatched'}
      </Badge>
    ),
  },
])

export const TRANSACTION_FILTERS = Object.freeze([
  {
    key: 'status',
    label: 'Payment status',
    options: Object.values(PAYMENT_STATUS).map((value) => ({
      value,
      label: PAYMENT_STATUS_LABELS[value],
    })),
  },
])

export const TRANSACTION_TABS = Object.freeze([
  { id: 'all', label: 'All payments' },
  { id: 'captured', label: 'Captured' },
  { id: 'refunds', label: 'Refunded' },
  { id: 'failed', label: 'Failed' },
  { id: 'unreconciled', label: 'Unreconciled' },
])

export const REFUND_COLUMNS = Object.freeze([
  {
    key: 'reference',
    header: 'Refund',
    width: '13rem',
    render: (row) => <PrimaryCell title={row.reference} subtitle={row.subOrderId} />,
  },
  { key: 'buyer', header: 'Buyer', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'reason', header: 'Reason', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'isPartial',
    header: 'Scope',
    width: '6.5rem',
    render: (row) => (
      <Badge tone={row.isPartial ? 'accent' : 'neutral'} size="sm">
        {row.isPartial ? 'Partial' : 'Full'}
      </Badge>
    ),
  },
  {
    key: 'transferReversed',
    header: 'Route transfer',
    width: '9.5rem',
    render: (row) => (
      <Badge tone={row.transferReversed ? 'success' : 'warning'} size="sm" dot>
        {row.transferReversed ? 'Reversed' : 'Not reversed'}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={REFUND_STATUS_LABELS}
        tones={REFUND_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.amount} />,
  },
])

export const REFUND_TABS = Object.freeze([
  { id: 'all', label: 'All refunds' },
  { id: 'open', label: 'Open' },
  { id: 'partial', label: 'Partial' },
  { id: 'failed', label: 'Failed' },
  { id: 'completed', label: 'Completed' },
])

export const SETTLEMENT_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Batch',
    width: '7rem',
    render: (row) => <IdCell id={row.id} to={adminPath.settlementBatch(row.id)} />,
  },
  {
    key: 'vendor',
    header: 'Vendor',
    render: (row) => (
      <PrimaryCell title={row.vendor} subtitle={`${row.subOrderCount} sub-orders · ${row.mode}`} />
    ),
  },
  { key: 'scheduledFor', header: 'Scheduled', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'gross',
    header: 'Gross',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.gross} muted />,
  },
  {
    key: 'commission',
    header: 'Commission',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} muted />,
  },
  {
    key: 'tds',
    header: 'TDS',
    width: '6rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.tds} muted />,
  },
  {
    key: 'net',
    header: 'Net payable',
    width: '8rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.net} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '10rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={SETTLEMENT_STATUS_LABELS}
        tones={SETTLEMENT_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const SETTLEMENT_FILTERS = Object.freeze([
  {
    key: 'status',
    label: 'Batch status',
    options: Object.values(SETTLEMENT_STATUS).map((value) => ({
      value,
      label: SETTLEMENT_STATUS_LABELS[value],
    })),
  },
])

export const SETTLEMENT_TABS = Object.freeze([
  { id: 'all', label: 'All batches' },
  { id: 'awaiting', label: 'Awaiting approval' },
  { id: 'hold', label: 'In hold window' },
  { id: 'failed', label: 'Failed' },
  { id: 'settled', label: 'Settled' },
])

export const VENDOR_LEDGER_COLUMNS = Object.freeze([
  {
    key: 'vendor',
    header: 'Vendor',
    render: (row) => (
      <PrimaryCell title={row.vendor} subtitle={row.model} to={adminPath.vendorLedger(row.id)} />
    ),
  },
  {
    key: 'opening',
    header: 'Opening',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.opening} muted />,
  },
  {
    key: 'credited',
    header: 'Credited',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.credited} muted />,
  },
  {
    key: 'debited',
    header: 'Paid out',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.debited} muted />,
  },
  {
    key: 'closing',
    header: 'Closing balance',
    width: '9rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.closing} />,
  },
  {
    key: 'lastSettledAt',
    header: 'Last settled',
    width: '8.5rem',
    render: (row) =>
      row.lastSettledAt ? (
        <span className="text-xs text-ink-muted">{row.lastSettledAt}</span>
      ) : (
        <Badge tone="warning" size="sm" dot>
          Never
        </Badge>
      ),
  },
])

export const VENDOR_LEDGER_TABS = Object.freeze([
  { id: 'all', label: 'All vendors' },
  { id: 'owing', label: 'Balance owing' },
  { id: 'settled', label: 'Fully settled' },
  { id: 'never_settled', label: 'Never settled' },
])

export const VOUCHER_COLUMNS = Object.freeze([
  {
    key: 'number',
    header: 'Voucher',
    width: '11rem',
    render: (row) => <PrimaryCell title={row.number} subtitle={row.date} />,
  },
  { key: 'narration', header: 'Narration', cellClassName: 'text-xs text-ink-muted' },
  { key: 'postedBy', header: 'Posted by', width: '10rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'debit',
    header: 'Debit',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.debit} muted />,
  },
  {
    key: 'credit',
    header: 'Credit',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.credit} muted />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={POST_STATUS_LABELS}
        tones={POST_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const VOUCHER_TABS = Object.freeze([
  { id: 'all', label: 'All vouchers' },
  { id: 'posted', label: 'Posted' },
  { id: 'draft', label: 'Draft' },
  { id: 'reversed', label: 'Reversed' },
])

export const EXPENSE_COLUMNS = Object.freeze([
  {
    key: 'category',
    header: 'Category',
    render: (row) => <PrimaryCell title={row.category} subtitle={row.narration} />,
  },
  { key: 'vendor', header: 'Paid to', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'date', header: 'Date', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'amount',
    header: 'Amount',
    width: '8rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.amount} />,
  },
  {
    key: 'gst',
    header: 'GST',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.gst} muted />,
  },
  {
    key: 'itcClaimable',
    header: 'Input credit',
    width: '8rem',
    render: (row) => (
      <Badge tone={row.itcClaimable ? 'success' : 'neutral'} size="sm">
        {row.itcClaimable ? 'Claimable' : 'Not claimable'}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '7rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={POST_STATUS_LABELS}
        tones={POST_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const EXPENSE_TABS = Object.freeze([
  { id: 'all', label: 'All expenses' },
  { id: 'draft', label: 'Draft' },
  { id: 'posted', label: 'Posted' },
  { id: 'paid', label: 'Paid' },
  { id: 'itc', label: 'Input credit' },
])

// Resolution order from project context §6.5 — most specific wins.
export const SCOPE_ORDER = ['product', 'vendor', 'category', 'company', 'default']
const SCOPE_TONE = { product: 'accent', vendor: 'brand', category: 'neutral', company: 'neutral', default: 'neutral' }

export const COMMISSION_RULE_COLUMNS = Object.freeze([
  {
    key: 'scope',
    header: 'Scope',
    width: '8rem',
    render: (row) => (
      <span className="flex items-center gap-2">
        <span className="tabular text-2xs text-ink-faint">
          {SCOPE_ORDER.indexOf(row.scope) + 1}
        </span>
        <Badge tone={SCOPE_TONE[row.scope]} size="sm">
          {row.scope.charAt(0).toUpperCase() + row.scope.slice(1)}
        </Badge>
      </span>
    ),
  },
  { key: 'target', header: 'Applies to', cellClassName: 'text-xs font-medium text-slate-900' },
  {
    key: 'value',
    header: 'Rate',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <span className="tabular font-semibold text-slate-900">
        {row.type === 'percentage' ? `${row.value}%` : `₹${row.value.toLocaleString('en-IN')}`}
      </span>
    ),
  },
  {
    key: 'appliesTo',
    header: 'Products covered',
    width: '9rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">
        {row.appliesTo.toLocaleString('en-IN')}
      </span>
    ),
  },
  { key: 'updatedAt', header: 'Updated', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
])

export const PRICE_TIER_COLUMNS = Object.freeze([
  { key: 'label', header: 'Buyer role', cellClassName: 'text-xs font-medium text-slate-900' },
  {
    key: 'discountFromRetail',
    header: 'Off retail',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <span className="tabular font-semibold text-slate-900">
        {row.discountFromRetail === 0 ? '—' : `${row.discountFromRetail}%`}
      </span>
    ),
  },
  { key: 'minQty', header: 'MOQ', width: '6rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'products',
    header: 'Products on this tier',
    width: '11rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">{row.products.toLocaleString('en-IN')}</span>
    ),
  },
])

const GROUP_LABELS = Object.freeze({
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
})

const GROUP_TONE = Object.freeze({
  asset: 'text-brand-700',
  liability: 'text-warning-700',
  equity: 'text-accent-700',
  income: 'text-success-700',
  expense: 'text-danger-700',
})

export const ACCOUNT_COLUMNS = Object.freeze([
  {
    key: 'code',
    header: 'Code',
    width: '5.5rem',
    render: (row) => <span className="tabular font-semibold text-slate-900">{row.code}</span>,
  },
  { key: 'name', header: 'Account', cellClassName: 'text-xs text-slate-800' },
  {
    key: 'group',
    header: 'Group',
    width: '7rem',
    render: (row) => (
      <span className={`text-2xs font-semibold uppercase tracking-wider ${GROUP_TONE[row.group]}`}>
        {GROUP_LABELS[row.group]}
      </span>
    ),
  },
  {
    key: 'isSubLedger',
    header: 'Sub-ledger',
    width: '7rem',
    render: (row) =>
      row.isSubLedger ? (
        <span className="text-2xs text-ink-muted">Per vendor</span>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  {
    key: 'balance',
    header: 'Balance',
    width: '9rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.balance} />,
  },
])
