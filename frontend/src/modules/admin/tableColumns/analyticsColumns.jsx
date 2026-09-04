import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { MoneyCell, PrimaryCell } from '../components/display'

// Rule 07: column definitions are DATA. The analytics pages import these;
// they never build a <th> or a threshold ternary inline.

// A rate that is bad above a threshold earns a status colour. Everything else
// stays in ink — colour here means "look at this", not "this is a vendor".
function Rate({ value, suffix = '%', warnAbove, goodAbove }) {
  const bad = warnAbove !== undefined && value > warnAbove
  const good = goodAbove !== undefined && value >= goodAbove
  return (
    <span
      className={`tabular font-semibold ${bad ? 'text-danger-700' : good ? 'text-success-700' : 'text-slate-800'}`}
    >
      {value}
      {suffix}
    </span>
  )
}

export const VENDOR_PERFORMANCE_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Vendor',
    render: (vendor) => (
      <PrimaryCell
        title={vendor.name}
        subtitle={vendor.model}
        to={adminPath.sellerDetail(vendor.id)}
      />
    ),
  },
  { key: 'orders', header: 'Orders', width: '5.5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '7rem',
    align: 'right',
    render: (vendor) => <MoneyCell amount={vendor.revenue} compact />,
  },
  {
    key: 'acceptanceRate',
    header: 'Accepted',
    width: '6rem',
    align: 'right',
    render: (vendor) => <Rate value={vendor.acceptanceRate} goodAbove={97} />,
  },
  {
    key: 'avgDispatchHours',
    header: 'Dispatch',
    width: '6rem',
    align: 'right',
    render: (vendor) => <Rate value={vendor.avgDispatchHours} suffix=" h" warnAbove={24} />,
  },
  {
    key: 'rtoRate',
    header: 'RTO',
    width: '5rem',
    align: 'right',
    render: (vendor) => <Rate value={vendor.rtoRate} warnAbove={3} />,
  },
  {
    key: 'rating',
    header: 'Rating',
    width: '5rem',
    align: 'right',
    render: (vendor) => <Rate value={vendor.rating} suffix="" goodAbove={4.5} />,
  },
])

export const TOP_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Product',
    render: (product) => (
      <PrimaryCell
        title={product.name}
        subtitle={product.sku}
        to={adminPath.productDetail(product.id)}
      />
    ),
  },
  { key: 'units', header: 'Units', width: '5.5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '7rem',
    align: 'right',
    render: (product) => <MoneyCell amount={product.revenue} compact />,
  },
  {
    key: 'returnRate',
    header: 'Returns',
    width: '6rem',
    align: 'right',
    render: (product) => <Rate value={product.returnRate} warnAbove={3} />,
  },
])

export const STOCK_RISK_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Product',
    render: (item) => <PrimaryCell title={item.name} subtitle={item.sku} />,
  },
  { key: 'onHand', header: 'On hand', width: '5.5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'daysCover',
    header: 'Days cover',
    width: '7rem',
    align: 'right',
    render: (item) => (
      <Badge tone={item.daysCover <= 3 ? 'danger' : 'warning'} size="sm" dot>
        {item.daysCover} days
      </Badge>
    ),
  },
])

export const TOP_CITY_COLUMNS = Object.freeze([
  { key: 'label', header: 'City', cellClassName: 'font-medium text-slate-900' },
  { key: 'orders', header: 'Orders', width: '6rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'revenue',
    header: 'Revenue',
    width: '7rem',
    align: 'right',
    render: (city) => <MoneyCell amount={city.revenue} compact />,
  },
])
