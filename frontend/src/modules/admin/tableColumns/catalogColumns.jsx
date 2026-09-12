import { Badge, Icon } from '../../../components/ui'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../constants'
import { PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

export const INVENTORY_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Product',
    render: (item) => <PrimaryCell title={item.name} subtitle={item.sku} />,
  },
  {
    key: 'bucket',
    header: 'Bucket',
    width: '7rem',
    render: (item) => (
      <Badge tone={item.bucket === 'own_stock' ? 'accent' : 'brand'} size="sm">
        {item.bucket === 'own_stock' ? 'Own stock' : 'Vendor'}
      </Badge>
    ),
  },
  { key: 'owner', header: 'Held by', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'onHand', header: 'On hand', width: '6rem', align: 'right', cellClassName: 'tabular' },
  { key: 'reserved', header: 'Reserved', width: '6rem', align: 'right', cellClassName: 'tabular text-ink-subtle' },
  {
    key: 'available',
    header: 'Available',
    width: '6.5rem',
    align: 'right',
    render: (item) => (
      <span className={`tabular font-semibold ${item.available === 0 ? 'text-danger-700' : 'text-slate-900'}`}>
        {item.available.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'daysCover',
    header: 'Days cover',
    width: '7rem',
    align: 'right',
    render: (item) =>
      item.daysCover === null ? (
        <span className="text-xs text-ink-faint">—</span>
      ) : (
        <Badge
          tone={item.daysCover <= 3 ? 'danger' : item.daysCover <= 7 ? 'warning' : 'neutral'}
          size="sm"
          dot={item.daysCover <= 7}
        >
          {item.daysCover} days
        </Badge>
      ),
  },
])

export const INVENTORY_TABS = Object.freeze([
  { id: 'all', label: 'All stock' },
  { id: 'own_stock', label: 'Own stock' },
  { id: 'vendor', label: 'Vendor stock' },
  { id: 'low', label: 'Running low' },
  { id: 'out', label: 'Out of stock' },
])

export const BRAND_COLUMNS = Object.freeze([
  { key: 'name', header: 'Brand', cellClassName: 'font-medium text-slate-900' },
  { key: 'owner', header: 'Owner', width: '14rem', cellClassName: 'text-xs text-ink-muted' },
  { key: 'productCount', header: 'Products', width: '6.5rem', align: 'right', cellClassName: 'tabular' },
  { key: 'submittedAt', header: 'Submitted', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'status',
    header: 'Status',
    width: '10rem',
    render: (brand) => (
      <StatusPill
        status={brand.status}
        labels={REVIEW_STATUS_LABELS}
        tones={REVIEW_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const ATTRIBUTE_COLUMNS = Object.freeze([
  { key: 'name', header: 'Attribute', width: '10rem', cellClassName: 'font-medium text-slate-900' },
  { key: 'type', header: 'Type', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'values',
    header: 'Values',
    render: (attribute) => (
      <span className="flex flex-wrap gap-1">
        {attribute.values.map((value) => (
          <span
            key={value}
            className="rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-muted"
          >
            {value}
          </span>
        ))}
      </span>
    ),
  },
  {
    key: 'usedBy',
    header: 'Used by',
    width: '7rem',
    align: 'right',
    render: (attribute) => (
      <span className="tabular text-xs text-ink-muted">
        {attribute.usedBy.toLocaleString('en-IN')} SKUs
      </span>
    ),
  },
])

// Depth is rendered as indentation rather than a disclosure widget: the tree
// is two levels deep, and a flat table with an indent reads faster than
// something nobody expands.
export const CATEGORY_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Category',
    render: (node) => (
      <span className="flex items-center gap-2" style={{ paddingLeft: `${node.depth * 1.25}rem` }}>
        {node.depth > 0 && <Icon name="chevronRight" className="h-3 w-3 text-border-strong" />}
        <span className={node.depth === 0 ? 'font-semibold text-slate-900' : 'text-ink-muted'}>
          {node.name}
        </span>
      </span>
    ),
  },
  {
    key: 'productCount',
    header: 'Products',
    width: '7rem',
    align: 'right',
    render: (node) => (
      <span className="tabular text-xs text-ink-muted">
        {node.productCount.toLocaleString('en-IN')}
      </span>
    ),
  },
  {
    key: 'commissionRate',
    header: 'Commission',
    width: '8rem',
    align: 'right',
    render: (node) =>
      node.commissionRate === null ? (
        <span className="text-2xs text-ink-faint">inherits</span>
      ) : (
        <span className="tabular font-semibold text-slate-900">{node.commissionRate}%</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (node) => (
      <StatusPill
        status={node.status}
        labels={REVIEW_STATUS_LABELS}
        tones={REVIEW_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const IMPORT_ERROR_COLUMNS = Object.freeze([
  { key: 'row', header: 'Row', width: '4.5rem', align: 'right', cellClassName: 'tabular' },
  { key: 'column', header: 'Column', width: '9rem', cellClassName: 'font-medium text-slate-900' },
  {
    key: 'value',
    header: 'Value',
    width: '11rem',
    render: (issue) => (
      <code className="tabular rounded bg-danger-50 px-1.5 py-0.5 text-2xs text-danger-700">
        {issue.value === '' ? '(empty)' : issue.value}
      </code>
    ),
  },
  { key: 'message', header: 'Problem', cellClassName: 'text-xs text-ink-muted' },
])

export const IMPORT_FIELD_OPTIONS = Object.freeze([
  { value: 'name', label: 'Product name' },
  { value: 'sku', label: 'SKU' },
  { value: 'mrp', label: 'MRP' },
  { value: 'price', label: 'Selling price' },
  { value: 'tax.hsn', label: 'HSN code' },
  { value: 'tax.gstRate', label: 'GST rate' },
  { value: 'inventory.onHand', label: 'Quantity on hand' },
])

const SYNC_RUN_TONE = Object.freeze({ success: 'success', partial: 'warning', failed: 'danger' })

export const SYNC_RUN_COLUMNS = Object.freeze([
  { key: 'adapter', header: 'Adapter', cellClassName: 'font-medium text-slate-900' },
  { key: 'startedAt', header: 'Started', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'durationSeconds',
    header: 'Duration',
    width: '6.5rem',
    align: 'right',
    render: (run) => <span className="tabular text-xs text-ink-muted">{run.durationSeconds}s</span>,
  },
  { key: 'updated', header: 'Updated', width: '6.5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'failed',
    header: 'Failed',
    width: '6rem',
    align: 'right',
    render: (run) => (
      <span
        className={`tabular font-semibold ${run.failed > 0 ? 'text-danger-700' : 'text-ink-faint'}`}
      >
        {run.failed}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Result',
    width: '7.5rem',
    render: (run) => (
      <Badge tone={SYNC_RUN_TONE[run.status]} size="sm" dot>
        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
      </Badge>
    ),
  },
])
