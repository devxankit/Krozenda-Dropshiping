import { Badge } from '../../../components/ui'
import { VENDOR_COUPON_STATUS_TONE, VENDOR_ORDER_STATUS_TONE, VENDOR_PRODUCT_STATUS_TONE, VENDOR_RETURN_STATUS_TONE } from '../constants'
import { DateCell, IdCell, MoneyCell, StatusPill } from '../../admin/components/display/cells'

function productStatusOf(row) {
  if (row.approvalStatus === 'PENDING') return 'pending'
  if (row.approvalStatus === 'REJECTED') return 'rejected'
  if (row.stock <= 0) return 'out_of_stock'
  return row.isActive ? 'active' : 'inactive'
}

export const VENDOR_PRODUCT_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'SKU / Product',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        {row.images?.[0] && <img src={row.images[0]} alt="" className="h-8 w-8 rounded-md object-cover" />}
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 text-xs">{row.name}</span>
          <span className="text-2xs text-ink-subtle">{row.sku || '—'} · {row.category?.name || 'Uncategorized'}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    width: '7.5rem',
    align: 'right',
    render: (row) => (
      <div className="flex flex-col items-end">
        <span className="tabular font-medium text-slate-900">₹{row.price.toLocaleString('en-IN')}</span>
        {row.salePrice != null && <span className="text-2xs text-emerald-600">₹{row.salePrice.toLocaleString('en-IN')}</span>}
      </div>
    ),
  },
  {
    key: 'stock',
    header: 'Stock',
    width: '7rem',
    align: 'right',
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
    render: (row) => <StatusPill status={productStatusOf(row)} tones={VENDOR_PRODUCT_STATUS_TONE} size="sm" />,
  },
])

export const VENDOR_PRODUCT_TABS = Object.freeze([
  { id: 'all', label: 'All Products' },
  { id: 'active', label: 'Active' },
  { id: 'out_of_stock', label: 'Out of Stock' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'rejected', label: 'Rejected' },
])

export const VENDOR_ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Order ID',
    width: '8.5rem',
    render: (row) => <IdCell id={row.id.slice(-8).toUpperCase()} />,
  },
  {
    key: 'items',
    header: 'Items',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.items[0]?.name}{row.items.length > 1 ? ` +${row.items.length - 1} more` : ''}</span>
        <span className="text-ink-subtle">Buyer: {row.customer.name}</span>
      </div>
    ),
  },
  {
    key: 'itemsValue',
    header: 'Order Value',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.itemsValue} compact />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => <StatusPill status={row.status} tones={VENDOR_ORDER_STATUS_TONE} size="sm" />,
  },
  {
    key: 'createdAt',
    header: 'Placed',
    width: '8rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
])

export const VENDOR_ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'New' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
])

export const VENDOR_CUSTOMER_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Customer',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.name}</span>
        <span className="text-ink-subtle">{row.mobileNumber || row.email}</span>
      </div>
    ),
  },
  { key: 'ordersCount', header: 'Orders', width: '6rem', align: 'right', render: (row) => <span className="tabular">{row.ordersCount}</span> },
  { key: 'totalSpent', header: 'Spent (with you)', width: '9rem', align: 'right', render: (row) => <MoneyCell amount={row.totalSpent} compact /> },
  { key: 'lastOrderAt', header: 'Last Order', width: '8rem', render: (row) => <DateCell value={row.lastOrderAt} withTime={false} /> },
])

export const VENDOR_COUPON_COLUMNS = Object.freeze([
  {
    key: 'code',
    header: 'Coupon',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs font-semibold text-brand-700">{row.code}</span>
        <span className="text-2xs text-ink-subtle">{row.description || 'No description'}</span>
      </div>
    ),
  },
  {
    key: 'discountValue',
    header: 'Discount',
    width: '8rem',
    render: (row) => (
      <span className="text-xs font-medium text-slate-900">
        {row.discountType === 'PERCENTAGE' ? `${row.discountValue}%` : row.discountType === 'FIXED' ? `₹${row.discountValue}` : 'Free shipping'}
      </span>
    ),
  },
  { key: 'usedCount', header: 'Used', width: '6rem', align: 'right', render: (row) => <span className="tabular">{row.usedCount}{row.usageLimit ? ` / ${row.usageLimit}` : ''}</span> },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => <Badge tone={VENDOR_COUPON_STATUS_TONE[row.status] || 'neutral'} size="sm">{row.status}</Badge>,
  },
])

export const VENDOR_COUPON_TABS = Object.freeze([
  { id: 'all', label: 'All coupons' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Scheduled' },
  { id: 'inactive', label: 'Paused' },
  { id: 'expired', label: 'Expired' },
  { id: 'usage_limit_reached', label: 'Exhausted' },
])

export const VENDOR_RETURN_COLUMNS = Object.freeze([
  {
    key: 'productName',
    header: 'Product',
    render: (row) => (
      <div className="flex flex-col text-xs">
        <span className="font-medium text-slate-900">{row.productName}</span>
        <span className="text-ink-subtle">{row.customer.name} · {row.requestType}</span>
      </div>
    ),
  },
  { key: 'reason', header: 'Reason', render: (row) => <span className="text-xs text-ink-muted line-clamp-2">{row.reason}</span> },
  {
    key: 'status',
    header: 'Status',
    width: '8rem',
    render: (row) => <StatusPill status={row.status} tones={VENDOR_RETURN_STATUS_TONE} size="sm" />,
  },
  {
    // The seller's own advisory input. Shown as a column so a queue can be
    // scanned for the ones still waiting on them, which is the only reason a
    // seller opens this screen.
    key: 'sellerRecommendation',
    header: 'Your response',
    width: '9rem',
    render: (row) => {
      if (row.sellerRecommendation) {
        return (
          <Badge tone={row.sellerRecommendation.decision === 'APPROVE' ? 'success' : 'danger'} size="sm">
            {row.sellerRecommendation.decision === 'APPROVE' ? 'Approve' : 'Reject'}
          </Badge>
        )
      }
      if (row.status !== 'PENDING') return <span className="text-2xs text-ink-faint">—</span>
      return <span className="text-2xs font-medium text-brand-700">Respond</span>
    },
  },
  { key: 'createdAt', header: 'Requested', width: '8rem', render: (row) => <DateCell value={row.createdAt} withTime={false} /> },
])

export const VENDOR_KYC_DOC_COLUMNS = Object.freeze([
  {
    key: 'documentType',
    header: 'Document Type',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium text-slate-900 text-xs">{row.documentLabel || row.documentType}</span>
        {row.documentNumber && <span className="text-2xs text-ink-subtle">{row.documentNumber}</span>}
      </div>
    ),
  },
  {
    key: 'documentUrl',
    header: 'File',
    width: '7rem',
    render: (row) =>
      row.documentUrl ? (
        <a href={row.documentUrl} target="_blank" rel="noreferrer" className="text-2xs font-semibold text-brand-700 hover:text-brand-600">
          View
        </a>
      ) : (
        <span className="text-2xs text-ink-faint">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Review State',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'} size="sm">
        {row.status}
      </Badge>
    ),
  },
  {
    key: 'createdAt',
    header: 'Uploaded',
    width: '8.5rem',
    render: (row) => <span className="text-xs text-ink-muted">{new Date(row.createdAt).toLocaleDateString('en-IN')}</span>,
  },
])
