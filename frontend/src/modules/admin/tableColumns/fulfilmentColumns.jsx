import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import { IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA.

const REASON_LABELS = Object.freeze({
  damaged: 'Damaged',
  wrong_product: 'Wrong product',
  missing_product: 'Missing product',
  undelivered: 'Undelivered',
  address_failure: 'Address failure',
  customer_unreachable: 'Customer unreachable',
  refused: 'Refused at door',
})

const RETURN_STATUS_LABELS = Object.freeze({
  awaiting_review: 'Awaiting review',
  approved: 'Approved — awaiting item',
  rejected: 'Rejected',
  replacement_issued: 'Replacement issued',
  refunded: 'Refunded',
})

const RETURN_STATUS_TONE = Object.freeze({
  awaiting_review: 'warning',
  approved: 'brand',
  rejected: 'danger',
  replacement_issued: 'accent',
  refunded: 'success',
})

export const SHIPMENT_TABS = Object.freeze([
  { id: 'all', label: 'All shipments' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'late', label: 'Running late' },
  { id: 'exception', label: 'Exceptions' },
  { id: 'delivered', label: 'Delivered' },
])

export const RETURN_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Request',
    width: '8rem',
    render: (row) => <IdCell id={row.id} to={adminPath.returnDetail(row.id)} />,
  },
  {
    key: 'buyer',
    header: 'Buyer',
    render: (row) => <PrimaryCell title={row.buyer} subtitle={`${row.subOrderId} · ${row.seller}`} />,
  },
  {
    key: 'reason',
    header: 'Reason',
    width: '10rem',
    render: (row) => (
      <Badge tone="neutral" size="sm" dot>
        {REASON_LABELS[row.reason]}
      </Badge>
    ),
  },
  {
    key: 'evidenceCount',
    header: 'Evidence',
    width: '7rem',
    align: 'right',
    render: (row) => (
      <span className={`tabular text-xs ${row.evidenceCount < 2 ? 'text-danger-700' : 'text-ink-muted'}`}>
        {row.evidenceCount} photo{row.evidenceCount === 1 ? '' : 's'}
      </span>
    ),
  },
  { key: 'raisedAt', header: 'Raised', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'status',
    header: 'Status',
    width: '10.5rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={RETURN_STATUS_LABELS}
        tones={RETURN_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'value',
    header: 'Value',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.value} />,
  },
])

export const RETURN_FILTERS = Object.freeze([
  {
    key: 'reason',
    label: 'Reason',
    options: [
      { value: 'damaged', label: 'Damaged' },
      { value: 'wrong_product', label: 'Wrong product' },
      { value: 'missing_product', label: 'Missing product' },
    ],
  },
])

export const RETURN_TABS = Object.freeze([
  { id: 'all', label: 'All requests' },
  { id: 'awaiting_review', label: 'Awaiting review' },
  { id: 'in_progress', label: 'Awaiting item' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'rejected', label: 'Rejected' },
])

export const INVOICE_COLUMNS = Object.freeze([
  {
    key: 'number',
    header: 'Invoice',
    width: '11rem',
    render: (row) => <IdCell id={row.number} to={adminPath.invoiceDetail(row.id)} />,
  },
  {
    key: 'sellerOfRecord',
    header: 'Seller of record',
    render: (row) => <PrimaryCell title={row.sellerOfRecord} subtitle={row.subOrderId} />,
  },
  { key: 'buyer', header: 'Buyer', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'placeOfSupply',
    header: 'Place of supply',
    width: '10rem',
    render: (row) => (
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-ink-muted">{row.placeOfSupply}</span>
        <span className="text-2xs text-ink-faint">{row.isInterState ? 'IGST' : 'CGST + SGST'}</span>
      </span>
    ),
  },
  { key: 'issuedAt', header: 'Issued', width: '7.5rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'gst',
    header: 'GST',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.gst} muted />,
  },
  {
    key: 'total',
    header: 'Total',
    width: '7.5rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.total} />,
  },
])

export const INVOICE_TABS = Object.freeze([
  { id: 'all', label: 'All invoices' },
  { id: 'krozenda', label: 'Krozenda is seller' },
  { id: 'vendor', label: 'Vendor is seller' },
  { id: 'inter_state', label: 'Inter-state' },
])

export { REASON_LABELS, RETURN_STATUS_LABELS, RETURN_STATUS_TONE }
