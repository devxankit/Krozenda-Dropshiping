import { Badge } from '../../../../components/ui'
import { ACCOUNTING_TXN_TYPE_LABELS, ACCOUNTING_TXN_TYPE_TONE } from '../../constants'
import { MoneyCell } from '../display'

// The two cells that are specific to the ledger, kept beside the other
// components rather than in tableColumns/ — they are used by the detail pages
// as well as by the tables, and a file that exports both components and
// column data stops fast refresh working.

// Type and colour both come from a map in constants.js; no screen decides
// what colour a transaction type is.
export function TypeBadge({ type }) {
  return (
    <Badge tone={ACCOUNTING_TXN_TYPE_TONE[type] || 'neutral'} size="sm">
      {ACCOUNTING_TXN_TYPE_LABELS[type] || type}
    </Badge>
  )
}

/**
 * A signed figure with its side spelled out — Cr for money owed to the seller,
 * Dr for money owed back. Used where a row's effect on a balance matters more
 * than which column it sat in, and for the running balance, which genuinely
 * can go negative (a seller refunded after being paid out).
 */
export function NetCell({ amount }) {
  if (amount === 0) return <span className="tabular text-ink-faint">₹0</span>

  const tone = amount > 0 ? 'text-success-700' : 'text-danger-700'
  return (
    <span className={tone}>
      <MoneyCell amount={Math.abs(amount)} className={tone} />
      <span className="ml-0.5 text-2xs">{amount > 0 ? 'Cr' : 'Dr'}</span>
    </span>
  )
}
