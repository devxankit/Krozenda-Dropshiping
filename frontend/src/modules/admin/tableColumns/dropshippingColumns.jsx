import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../constants'
import { IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

const PARTNER_STATUS_TONE = Object.freeze({
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
})

const SYNC_STATUS_TONE = Object.freeze({
  operational: 'success',
  pending: 'warning',
  sync_error: 'danger',
})

export const DROPSHIP_PARTNER_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Partner / Supplier',
    sortable: true,
    render: (row) => (
      <PrimaryCell
        title={row.name}
        subtitle={`${row.supplierType} · ${row.city}`}
        to={adminPath.dropshipPartnerDetail(row.id)}
      />
    ),
  },
  {
    key: 'integrationMode',
    header: 'Integration mode',
    width: '10.5rem',
    render: (row) => (
      <Badge tone={row.integrationMode.includes('API') ? 'brand' : 'neutral'} size="sm">
        {row.integrationMode}
      </Badge>
    ),
  },
  {
    key: 'products',
    header: 'Live SKUs',
    width: '6.5rem',
    align: 'right',
    sortable: true,
    cellClassName: 'tabular text-slate-900 font-medium',
  },
  {
    key: 'ordersCount',
    header: 'Orders',
    width: '6rem',
    align: 'right',
    sortable: true,
    cellClassName: 'tabular text-slate-900',
  },
  {
    key: 'revenue',
    header: 'Gross revenue',
    width: '9rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.revenue} compact />,
  },
  {
    key: 'kycStatus',
    header: 'KYC state',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={REVIEW_STATUS_TONE[row.kycStatus]} size="sm">
        {REVIEW_STATUS_LABELS[row.kycStatus]}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '6.5rem',
    render: (row) => <StatusPill status={row.status} tones={PARTNER_STATUS_TONE} />,
  },
])

export const DROPSHIP_PARTNER_TABS = Object.freeze([
  { id: 'all', label: 'All suppliers' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending KYC' },
  { id: 'api_integrated', label: 'API Integrated' },
])

export const DROPSHIP_PARTNER_FILTERS = Object.freeze([
  {
    key: 'supplierType',
    label: 'Supplier type',
    options: [
      { value: 'Manufacturer', label: 'Manufacturer' },
      { value: 'Wholesaler', label: 'Wholesaler' },
      { value: 'Distributor', label: 'Distributor' },
      { value: 'Trader', label: 'Trader' },
      { value: 'Company', label: 'Company' },
    ],
  },
  {
    key: 'integrationMode',
    label: 'Integration',
    options: [
      { value: 'API', label: 'API Adapter' },
      { value: 'Feed', label: 'CSV/Excel Feed' },
    ],
  },
])

export const DROPSHIP_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'sku',
    header: 'SKU / Product',
    sortable: true,
    render: (row) => (
      <PrimaryCell
        title={row.name}
        subtitle={`${row.sku} · ${row.category}`}
        to={adminPath.productDetail(row.id)}
      />
    ),
  },
  {
    key: 'partnerName',
    header: 'Supplier partner',
    width: '11rem',
    render: (row) => <span className="text-xs font-medium text-slate-900">{row.partnerName}</span>,
  },
  {
    key: 'costPrice',
    header: 'Base cost',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.costPrice} compact />,
  },
  {
    key: 'sellingPrice',
    header: 'List price',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.sellingPrice} compact />,
  },
  {
    key: 'marginPct',
    header: 'Margin %',
    width: '6.5rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className="tabular font-semibold text-success-600">
        {row.marginPct.toFixed(1)}%
      </span>
    ),
  },
  {
    key: 'supplierStock',
    header: 'Supplier stock',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={`tabular font-medium ${row.supplierStock > 0 ? 'text-slate-900' : 'text-danger-600 font-semibold'}`}>
        {row.supplierStock > 0 ? row.supplierStock.toLocaleString('en-IN') : 'Out of stock'}
      </span>
    ),
  },
  {
    key: 'syncStatus',
    header: 'Sync state',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={SYNC_STATUS_TONE[row.syncStatus] || 'neutral'} size="sm">
        {row.syncStatus}
      </Badge>
    ),
  },
])

export const DROPSHIP_PRODUCT_TABS = Object.freeze([
  { id: 'all', label: 'All SKUs' },
  { id: 'in_stock', label: 'In stock' },
  { id: 'out_of_stock', label: 'Out of stock' },
  { id: 'sync_issues', label: 'Sync issues' },
])

export const DROPSHIP_PRODUCT_FILTERS = Object.freeze([
  {
    key: 'partnerName',
    label: 'Supplier',
    options: [
      { value: 'Arya Manufacturing', label: 'Arya Manufacturing' },
      { value: 'Meghna Wholesale', label: 'Meghna Wholesale' },
      { value: 'Kritika Enterprises', label: 'Kritika Enterprises' },
      { value: 'Deccan Spice Traders', label: 'Deccan Spice Traders' },
    ],
  },
])

export const FORWARDED_ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Sub-Order ID',
    width: '8.5rem',
    render: (row) => <IdCell id={row.id} to={adminPath.subOrderDetail(row.id)} />,
  },
  {
    key: 'partnerName',
    header: 'Forwarded Supplier',
    width: '10.5rem',
    render: (row) => <span className="text-xs font-semibold text-slate-900">{row.partnerName}</span>,
  },
  {
    key: 'productName',
    header: 'Product',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.productName}</span>
        <span className="text-ink-subtle">Qty: {row.quantity} · Buyer: {row.customerName}</span>
      </div>
    ),
  },
  {
    key: 'orderValue',
    header: 'Order value',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.orderValue} compact />,
  },
  {
    key: 'commissionAmount',
    header: 'Platform margin',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commissionAmount} compact className="text-success-600 font-medium" />,
  },
  {
    key: 'forwardingStatus',
    header: 'Forward state',
    width: '9rem',
    render: (row) => (
      <Badge
        tone={
          row.forwardingStatus === 'shipped'
            ? 'success'
            : row.forwardingStatus === 'vendor_accepted' || row.forwardingStatus === 'packed'
            ? 'brand'
            : 'warning'
        }
        size="sm"
      >
        {row.forwardingStatus.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    key: 'awb',
    header: 'Shipment AWB',
    width: '9.5rem',
    render: (row) =>
      row.awb ? (
        <span className="font-mono text-xs text-slate-900">{row.awb}</span>
      ) : (
        <span className="text-2xs text-ink-faint">Pending dispatch</span>
      ),
  },
])

export const FORWARDED_ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All orders' },
  { id: 'awaiting_partner', label: 'Awaiting supplier' },
  { id: 'accepted', label: 'Supplier accepted' },
  { id: 'shipped', label: 'Shipped' },
])

export const FORWARDED_ORDER_FILTERS = Object.freeze([])

export const MARGIN_RULE_COLUMNS = Object.freeze([
  {
    key: 'ruleName',
    header: 'Rule name',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-slate-900">{row.ruleName}</span>
        <span className="text-xs text-ink-subtle">Target: {row.targetName}</span>
      </div>
    ),
  },
  {
    key: 'scope',
    header: 'Scope hierarchy',
    width: '9rem',
    render: (row) => (
      <Badge tone="brand" size="sm">
        {row.scope.toUpperCase()}
      </Badge>
    ),
  },
  {
    key: 'value',
    header: 'Margin rate',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <span className="tabular text-sm font-bold text-slate-900">
        {row.commissionType === 'percentage' ? `${row.value}%` : `₹${row.value}`}
      </span>
    ),
  },
  {
    key: 'manualOverrideAllowed',
    header: 'Manual override',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={row.manualOverrideAllowed ? 'success' : 'neutral'} size="sm">
        {row.manualOverrideAllowed ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '6.5rem',
    render: (row) => (
      <Badge tone={row.status === 'active' ? 'success' : 'neutral'} size="sm">
        {row.status}
      </Badge>
    ),
  },
])
