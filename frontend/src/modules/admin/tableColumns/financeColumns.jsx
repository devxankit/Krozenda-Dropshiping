import { Badge } from '../../../components/ui'

// Rule 07: column definitions and filter schemas are DATA.

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
