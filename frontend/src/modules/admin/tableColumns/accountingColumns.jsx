import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import {
  ACCOUNTING_REFUND_STATUS_LABELS,
  ACCOUNTING_REFUND_STATUS_TONE,
  ACCOUNTING_SETTLEMENT_STATUS_LABELS,
  ACCOUNTING_SETTLEMENT_STATUS_TONE,
  ACCOUNTING_TXN_STATUS_LABELS,
  ACCOUNTING_TXN_STATUS_TONE,
  ACCOUNTING_TXN_TYPE,
  ACCOUNTING_TXN_TYPE_LABELS,
  COMMISSION_RULE_STATE_LABELS,
  COMMISSION_RULE_STATE_TONE,
  COMMISSION_SCOPE_LABELS,
  ORDER_PAYMENT_METHOD_LABELS,
  PAYOUT_METHOD_LABELS,
  PAYOUT_METHOD_TONE,
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONE,
} from '../constants'
import { DateCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'
import { NetCell, TypeBadge } from '../components/accounting/AccountingCells'

// Rule 07: column definitions and filter schemas are DATA.
//
// Money columns render `paise` straight through MoneyCell — the ledger, the
// API and formatMoney all speak paise, so nothing here divides by 100.

// A credit/debit pair reads much faster as one signed column than as two that
// are empty half the time, but the ledger is a double-sided document and an
// accountant expects to see both. Lists show both; the running balance
// column carries the sign.
const creditColumn = {
  key: 'credit',
  header: 'Credit',
  width: '8rem',
  align: 'right',
  render: (row) => (row.credit > 0 ? <MoneyCell amount={row.credit} /> : <span className="text-ink-faint">—</span>),
}

const debitColumn = {
  key: 'debit',
  header: 'Debit',
  width: '8rem',
  align: 'right',
  render: (row) => (row.debit > 0 ? <MoneyCell amount={row.debit} /> : <span className="text-ink-faint">—</span>),
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const TRANSACTION_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'transactionId',
    header: 'Transaction ID',
    width: '12rem',
    render: (row) => (
      <PrimaryCell
        title={row.transactionId}
        subtitle={row.orderNumber || row.referenceType}
        to={adminPath.accountingTransaction(row.id)}
      />
    ),
  },
  {
    key: 'orderNumber',
    header: 'Order',
    width: '9rem',
    cellClassName: 'text-xs text-ink-muted tabular',
    render: (row) => row.orderNumber || <span className="text-ink-faint">—</span>,
  },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) =>
      row.sellerId ? (
        <PrimaryCell title={row.seller} to={adminPath.accountingSellerLedger(row.sellerId)} />
      ) : (
        <span className="text-xs text-ink-faint">Platform</span>
      ),
  },
  { key: 'type', header: 'Type', width: '9.5rem', render: (row) => <TypeBadge type={row.type} /> },
  creditColumn,
  debitColumn,
  {
    key: 'net',
    header: 'Net',
    width: '8.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <NetCell amount={row.net} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={ACCOUNTING_TXN_STATUS_LABELS}
        tones={ACCOUNTING_TXN_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    width: '9rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const TRANSACTION_TABS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'sales', label: 'Sales' },
  { id: 'commission', label: 'Commission' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'fees', label: 'Fees & shipping' },
  { id: 'adjustments', label: 'Adjustments' },
])

export const transactionFilters = (sellers = []) =>
  Object.freeze([
    {
      key: 'type',
      label: 'Type',
      options: Object.values(ACCOUNTING_TXN_TYPE).map((value) => ({
        value,
        label: ACCOUNTING_TXN_TYPE_LABELS[value],
      })),
    },
    {
      key: 'status',
      label: 'Status',
      options: Object.keys(ACCOUNTING_TXN_STATUS_LABELS).map((value) => ({
        value,
        label: ACCOUNTING_TXN_STATUS_LABELS[value],
      })),
    },
    {
      key: 'paymentMethod',
      label: 'Payment method',
      options: Object.entries(ORDER_PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })),
    },
    { key: 'sellerId', label: 'Seller', options: sellers },
  ])

export const PENDING_COD_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'orderNumber',
    header: 'Order',
    width: '11rem',
    render: (row) => <PrimaryCell title={row.orderNumber} subtitle={`${row.sellers} seller(s)`} />,
  },
  { key: 'buyer', header: 'Buyer', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'deliveredAt',
    header: 'Delivered',
    width: '10rem',
    render: (row) => (row.deliveredAt ? <DateCell value={row.deliveredAt} /> : '—'),
  },
  {
    key: 'amount',
    header: 'Cash to collect',
    width: '10rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.amount} />,
  },
])

// ---------------------------------------------------------------------------
// Seller ledger
// ---------------------------------------------------------------------------

export const SELLER_LEDGER_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) => (
      <PrimaryCell
        title={row.seller}
        subtitle={row.isActive ? row.sellerType : 'Inactive'}
        to={adminPath.accountingSellerLedger(row.id)}
      />
    ),
  },
  {
    key: 'totalSales',
    header: 'Sales',
    width: '8.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.totalSales} />,
  },
  {
    key: 'totalCommission',
    header: 'Commission',
    width: '8.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.totalCommission} muted />,
  },
  {
    key: 'totalRefunds',
    header: 'Refunds',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.totalRefunds} muted />,
  },
  {
    key: 'totalPaid',
    header: 'Paid out',
    width: '8.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.totalPaid} muted />,
  },
  {
    key: 'currentPayable',
    header: 'Current payable',
    width: '10rem',
    align: 'right',
    sortable: true,
    // A negative payable is a real state — a seller refunded after being paid
    // owes the platform — so it is shown as such rather than clamped to zero.
    render: (row) => <NetCell amount={row.currentPayable} />,
  },
  {
    key: 'availableForSettlement',
    header: 'Settleable',
    width: '9rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.availableForSettlement} />,
  },
])

export const SELLER_LEDGER_TABS = Object.freeze([
  { id: 'all', label: 'All sellers' },
  { id: 'owing', label: 'We owe' },
  { id: 'negative', label: 'Owes us' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'settled', label: 'Square' },
])

export const LEDGER_ENTRY_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  { key: 'date', header: 'Date', width: '9rem', render: (row) => <DateCell value={row.date} /> },
  {
    key: 'reference',
    header: 'Reference',
    width: '12rem',
    render: (row) => (
      <PrimaryCell
        title={row.transactionId}
        subtitle={row.orderNumber || row.settlementId || row.payoutId || '—'}
        to={adminPath.accountingTransaction(row.id)}
      />
    ),
  },
  { key: 'type', header: 'Type', width: '9.5rem', render: (row) => <TypeBadge type={row.type} /> },
  creditColumn,
  debitColumn,
  {
    key: 'runningBalance',
    header: 'Running balance',
    width: '10rem',
    align: 'right',
    render: (row) => <NetCell amount={row.runningBalance} />,
  },
  { key: 'description', header: 'Description', cellClassName: 'text-xs text-ink-muted' },
])

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export const COMMISSION_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'name',
    header: 'Rule',
    render: (row) => <PrimaryCell title={row.name} subtitle={row.target} />,
  },
  {
    key: 'scope',
    header: 'Scope',
    width: '8rem',
    render: (row) => (
      <Badge tone="neutral" size="sm">
        {COMMISSION_SCOPE_LABELS[row.scope] || row.scope}
      </Badge>
    ),
  },
  {
    key: 'value',
    header: 'Rate',
    width: '7rem',
    align: 'right',
    render: (row) =>
      row.type === 'PERCENTAGE' ? (
        <span className="tabular font-semibold text-slate-900">{row.value}%</span>
      ) : (
        <MoneyCell amount={Math.round(row.value * 100)} />
      ),
  },
  { key: 'priority', header: 'Priority', width: '6rem', align: 'right', cellClassName: 'tabular text-xs text-ink-muted' },
  {
    key: 'window',
    header: 'Active window',
    width: '13rem',
    cellClassName: 'text-2xs text-ink-muted',
    render: (row) => {
      if (!row.startDate && !row.endDate) return 'Always'
      const from = row.startDate ? new Date(row.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Any'
      const to = row.endDate ? new Date(row.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Any'
      return `${from} → ${to}`
    },
  },
  {
    // The count that makes "editing this will not change history" concrete.
    key: 'appliedCount',
    header: 'Already charged',
    width: '9.5rem',
    align: 'right',
    render: (row) =>
      row.appliedCount === 0 ? (
        <span className="text-2xs text-ink-faint">Never applied</span>
      ) : (
        <span className="tabular text-xs text-ink-muted">
          {row.appliedCount} · <MoneyCell amount={row.appliedAmount} muted />
        </span>
      ),
  },
  {
    key: 'state',
    header: 'Status',
    width: '8rem',
    render: (row) => (
      <StatusPill
        status={row.state}
        labels={COMMISSION_RULE_STATE_LABELS}
        tones={COMMISSION_RULE_STATE_TONE}
        size="sm"
      />
    ),
  },
])

export const COMMISSION_TABS = Object.freeze([
  { id: 'all', label: 'All rules' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'expired', label: 'Expired' },
  { id: 'inactive', label: 'Retired' },
])

export const COMMISSION_FILTERS = Object.freeze([
  {
    key: 'scope',
    label: 'Scope',
    options: Object.entries(COMMISSION_SCOPE_LABELS).map(([value, label]) => ({ value, label })),
  },
])

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

function periodLabel(row) {
  if (!row.periodStart || !row.periodEnd) return '—'
  const format = (value) =>
    new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${format(row.periodStart)} → ${format(row.periodEnd)}`
}

export const SETTLEMENT_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'settlementId',
    header: 'Settlement ID',
    width: '12rem',
    render: (row) => (
      <PrimaryCell
        title={row.settlementId}
        subtitle={`${row.lineCount} line${row.lineCount === 1 ? '' : 's'}`}
        to={adminPath.accountingSettlement(row.id)}
      />
    ),
  },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) => <PrimaryCell title={row.seller} to={adminPath.accountingSellerLedger(row.sellerId)} />,
  },
  { key: 'period', header: 'Period', width: '10rem', cellClassName: 'text-2xs text-ink-muted', render: periodLabel },
  {
    key: 'grossSales',
    header: 'Gross',
    width: '8.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.grossSales} />,
  },
  {
    key: 'commission',
    header: 'Commission',
    width: '8.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} muted />,
  },
  {
    key: 'fees',
    header: 'Fees',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.fees} muted />,
  },
  {
    key: 'refunds',
    header: 'Refunds',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.refunds} muted />,
  },
  {
    key: 'netPayable',
    header: 'Net payable',
    width: '9.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.netPayable} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={ACCOUNTING_SETTLEMENT_STATUS_LABELS}
        tones={ACCOUNTING_SETTLEMENT_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    width: '9rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const SETTLEMENT_TABS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'eligible', label: 'Eligible' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'failed', label: 'Failed' },
])

export const SETTLEMENT_LINE_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'orderNumber',
    header: 'Order',
    width: '11rem',
    render: (row) => <PrimaryCell title={row.orderNumber} subtitle={row.productName} />,
  },
  { key: 'quantity', header: 'Qty', width: '4.5rem', align: 'right', cellClassName: 'tabular text-xs' },
  {
    key: 'deliveredAt',
    header: 'Delivered',
    width: '9rem',
    render: (row) => (row.deliveredAt ? <DateCell value={row.deliveredAt} withTime={false} /> : '—'),
  },
  {
    key: 'eligibleAt',
    header: 'Eligible',
    width: '9rem',
    render: (row) => (row.eligibleAt ? <DateCell value={row.eligibleAt} withTime={false} /> : '—'),
  },
  { key: 'gross', header: 'Gross', width: '8rem', align: 'right', render: (row) => <MoneyCell amount={row.gross} /> },
  {
    key: 'commission',
    header: 'Commission',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} muted />,
  },
  {
    key: 'refunds',
    header: 'Refunds',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.refunds} muted />,
  },
  { key: 'net', header: 'Net', width: '8.5rem', align: 'right', render: (row) => <MoneyCell amount={row.net} /> },
])

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export const PAYOUT_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'payoutId',
    header: 'Payout ID',
    width: '12rem',
    render: (row) => (
      <PrimaryCell
        title={row.payoutId}
        subtitle={row.attempt > 1 ? `Attempt ${row.attempt}` : row.method}
        to={adminPath.accountingPayout(row.id)}
      />
    ),
  },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) => <PrimaryCell title={row.seller} to={adminPath.accountingSellerLedger(row.sellerId)} />,
  },
  {
    key: 'settlementId',
    header: 'Settlement',
    width: '11rem',
    render: (row) => (
      <PrimaryCell title={row.settlementId} to={adminPath.accountingSettlement(row.settlementRef)} />
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    width: '9.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.amount} />,
  },
  {
    key: 'method',
    header: 'Method',
    width: '9rem',
    render: (row) =>
      row.method === 'RAZORPAY_ROUTE' ? (
        <Badge tone={PAYOUT_METHOD_TONE.RAZORPAY_ROUTE} size="sm">
          {PAYOUT_METHOD_LABELS.RAZORPAY_ROUTE}
        </Badge>
      ) : (
        <span className="text-xs text-ink-muted">{PAYOUT_METHOD_LABELS[row.method] || row.method}</span>
      ),
  },
  {
    // Masked at the source — the API never sends the full number.
    key: 'bankAccountMasked',
    header: 'Bank account',
    width: '10rem',
    cellClassName: 'tabular text-xs text-ink-muted',
    render: (row) => row.bankAccountMasked || '—',
  },
  {
    key: 'utr',
    header: 'UTR / Transfer ID',
    width: '11rem',
    cellClassName: 'tabular text-xs text-ink-muted',
    render: (row) => {
      const reference = row.utr || row.razorpayTransferId
      if (!reference) return <span className="text-ink-faint">—</span>
      return (
        <span className="block max-w-[10rem] truncate" title={reference}>
          {reference}
        </span>
      )
    },
  },
  {
    key: 'status',
    header: 'Status',
    width: '8.5rem',
    render: (row) => (
      <StatusPill status={row.status} labels={PAYOUT_STATUS_LABELS} tones={PAYOUT_STATUS_TONE} size="sm" />
    ),
  },
  { key: 'createdAt', header: 'Created', width: '9rem', render: (row) => <DateCell value={row.createdAt} /> },
  {
    key: 'processedAt',
    header: 'Processed',
    width: '9rem',
    render: (row) => (row.processedAt ? <DateCell value={row.processedAt} /> : <span className="text-ink-faint">—</span>),
  },
])

export const PAYOUT_TABS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'PROCESSING', label: 'Processing' },
  { id: 'RELEASED', label: 'Release requested' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'CANCELLED', label: 'Cancelled' },
])

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export const REFUND_COLUMNS = Object.freeze([
  { key: 'sn', header: 'SN', width: '3.5rem', cellClassName: 'text-2xs text-ink-faint tabular' },
  {
    key: 'refundId',
    header: 'Refund ID',
    width: '11.5rem',
    render: (row) => <PrimaryCell title={row.refundId} subtitle={row.productName || 'Whole order'} />,
  },
  {
    key: 'orderNumber',
    header: 'Order',
    width: '10rem',
    cellClassName: 'tabular text-xs text-ink-muted',
  },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) =>
      row.sellerId ? (
        <PrimaryCell title={row.seller} to={adminPath.accountingSellerLedger(row.sellerId)} />
      ) : (
        <span className="text-xs text-ink-muted">{row.seller}</span>
      ),
  },
  { key: 'customer', header: 'Customer', width: '10rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'amount',
    header: 'Refund amount',
    width: '9.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.amount} />,
  },
  {
    key: 'refundType',
    header: 'Type',
    width: '7rem',
    render: (row) => (
      <Badge tone={row.refundType === 'FULL' ? 'danger' : 'warning'} size="sm">
        {row.refundType === 'FULL' ? 'Full' : 'Partial'}
      </Badge>
    ),
  },
  { key: 'reason', header: 'Reason', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'status',
    header: 'Status',
    width: '8.5rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={ACCOUNTING_REFUND_STATUS_LABELS}
        tones={ACCOUNTING_REFUND_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    // Whether the reversal actually reached the ledger. A completed refund
    // that never posted is the one thing an operator must be able to spot.
    key: 'ledgerPosted',
    header: 'Ledger',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={row.ledgerPosted ? 'success' : 'neutral'} size="sm" dot>
        {row.ledgerPosted ? 'Posted' : 'Not posted'}
      </Badge>
    ),
  },
  { key: 'createdAt', header: 'Created', width: '9rem', render: (row) => <DateCell value={row.createdAt} /> },
])

export const REFUND_TABS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'partial', label: 'Partial' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Declined' },
])
