import { Badge } from '../../../components/ui'
import { VENDOR_ORDER_STATUS_TONE, VENDOR_PRODUCT_STATUS_TONE } from '../constants'
import { IdCell, MoneyCell, PrimaryCell, StatusPill } from '../../admin/components/display'

export const VENDOR_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'sku',
    header: 'SKU / Product',
    sortable: true,
    render: (row) => (
      <PrimaryCell
        title={row.name}
        subtitle={`${row.sku} · ${row.category}`}
        image={row.imageUrl}
      />
    ),
  },
  {
    key: 'costPrice',
    header: 'Base Cost',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.costPrice} compact />,
  },
  {
    key: 'sellingPrice',
    header: 'Selling Price',
    width: '7.5rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.sellingPrice} compact />,
  },
  {
    key: 'marginPct',
    header: 'Gross Margin',
    width: '7rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className="tabular font-medium text-emerald-600">
        {row.marginPct}%
      </span>
    ),
  },
  {
    key: 'stock',
    header: 'Available Stock',
    width: '8rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={`tabular font-medium ${row.stock > 0 ? 'text-slate-900' : 'text-danger-600'}`}>
        {row.stock > 0 ? `${row.stock.toLocaleString('en-IN')} units` : 'Out of stock'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '8.5rem',
    render: (row) => <StatusPill status={row.status} tones={VENDOR_PRODUCT_STATUS_TONE} size="sm" />,
  },
])

export const VENDOR_PRODUCT_TABS = Object.freeze([
  { id: 'all', label: 'All SKUs' },
  { id: 'active', label: 'Active' },
  { id: 'out_of_stock', label: 'Out of Stock' },
  { id: 'pending', label: 'Pending Approval' },
])

export const VENDOR_PRODUCT_FILTERS = Object.freeze([
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'out_of_stock', label: 'Out of Stock' },
      { value: 'pending_approval', label: 'Pending Approval' },
    ],
  },
])

export const VENDOR_ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Sub-Order ID',
    width: '8.5rem',
    render: (row) => <IdCell id={row.id} />,
  },
  {
    key: 'productName',
    header: 'Product Details',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.productName}</span>
        <span className="text-ink-subtle">Qty: {row.quantity} · Buyer: {row.customerName}</span>
      </div>
    ),
  },
  {
    key: 'orderValue',
    header: 'Order Value',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.orderValue} compact />,
  },
  {
    key: 'netPayable',
    header: 'Net Payout',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.netPayable} compact className="text-emerald-600 font-medium" />,
  },
  {
    key: 'forwardingStatus',
    header: 'Fulfillment Status',
    width: '9.5rem',
    render: (row) => <StatusPill status={row.forwardingStatus} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />,
  },
  {
    key: 'awb',
    header: 'AWB Number',
    width: '9rem',
    render: (row) =>
      row.awb ? (
        <span className="font-mono text-xs text-slate-900">{row.awb}</span>
      ) : (
        <span className="text-2xs text-ink-faint">Pending AWB</span>
      ),
  },
])

export const VENDOR_ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All Orders' },
  { id: 'new_orders', label: 'New Orders' },
  { id: 'accepted', label: 'Accepted & Packing' },
  { id: 'shipped', label: 'Shipped' },
])

export const VENDOR_ORDER_FILTERS = Object.freeze([])

export const VENDOR_SETTLEMENT_COLUMNS = Object.freeze([
  {
    key: 'routeTransferId',
    header: 'Route Transfer ID',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs font-medium text-brand-700">{row.routeTransferId}</span>
        <span className="text-2xs text-ink-subtle">Sub-Order: {row.subOrderId}</span>
      </div>
    ),
  },
  {
    key: 'grossAmount',
    header: 'Gross Order Sales',
    width: '9.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.grossAmount} compact />,
  },
  {
    key: 'commission',
    header: 'Platform Fee',
    width: '8rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.commission} compact className="text-ink-subtle" />,
  },
  {
    key: 'netPayout',
    header: 'Net Settled Payout',
    width: '9.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.netPayout} compact className="font-semibold text-emerald-600" />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={row.status === 'settled' ? 'success' : 'warning'} size="sm">
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'transferredAt',
    header: 'Settled Date',
    width: '8.5rem',
    render: (row) => <span className="text-xs text-ink-muted">{row.transferredAt}</span>,
  },
])

export const VENDOR_KYC_DOC_COLUMNS = Object.freeze([
  {
    key: 'type',
    header: 'Document Type',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-slate-900 text-xs">{row.type}</span>
        {row.fileName && <span className="text-2xs text-ink-subtle">{row.fileName} ({row.fileSize})</span>}
      </div>
    ),
  },
  {
    key: 'required',
    header: 'Requirement',
    width: '7.5rem',
    render: (row) => (
      <Badge tone={row.required ? 'brand' : 'neutral'} size="sm">
        {row.required ? 'Mandatory' : 'Optional'}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Review State',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={row.status === 'approved' ? 'success' : row.status === 'reviewing' ? 'warning' : 'neutral'} size="sm">
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'uploadedAt',
    header: 'Last Uploaded',
    width: '8.5rem',
    render: (row) => <span className="text-xs text-ink-muted">{row.uploadedAt || 'Not uploaded'}</span>,
  },
])
