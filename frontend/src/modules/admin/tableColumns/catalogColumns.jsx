import { Badge } from '../../../components/ui'
import { PrimaryCell } from '../components/display'

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
