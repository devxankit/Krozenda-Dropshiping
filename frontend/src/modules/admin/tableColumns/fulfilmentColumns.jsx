import { Badge } from '../../../components/ui'
import { adminPath } from '../../../config/routes'
import {
  BUSINESS_MODEL,
  BUSINESS_MODEL_LABELS,
  ORDER_STATUS_LABELS,
} from '../../../config/constants'
import { BUSINESS_MODEL_SERIES, ORDER_STATUS_TONE } from '../constants'
import { DateCell, IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'
import { SERIES } from '../components/charts/chartTheme'

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

const REFUND_STATUS_LABELS = Object.freeze({
  not_required: 'Not required',
  pending: 'Pending',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
})

const REFUND_STATUS_TONE = Object.freeze({
  not_required: 'neutral',
  pending: 'warning',
  processing: 'brand',
  completed: 'success',
  failed: 'danger',
})

const SHIPMENT_STATUS_LABELS = Object.freeze({
  in_transit: 'In transit',
  delivered: 'Delivered',
  rto_in_transit: 'RTO in transit',
  exception: 'Exception',
})

const SHIPMENT_STATUS_TONE = Object.freeze({
  in_transit: 'brand',
  delivered: 'success',
  rto_in_transit: 'warning',
  exception: 'danger',
})

const BEARER_TONE = Object.freeze({ platform: 'accent', vendor: 'warning', buyer: 'neutral' })

function ModelCell({ model }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: SERIES[BUSINESS_MODEL_SERIES[model] - 1] }}
      />
      {BUSINESS_MODEL_LABELS[model]}
    </span>
  )
}

export const SUB_ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Sub-order',
    width: '9.5rem',
    sortable: true,
    render: (row) => <IdCell id={row.id} to={adminPath.orderDetail(row.orderId)} />,
  },
  {
    key: 'model',
    header: 'Model',
    width: '9rem',
    render: (row) => <ModelCell model={row.model} />,
  },
  {
    key: 'seller',
    header: 'Seller',
    render: (row) => <PrimaryCell title={row.seller} subtitle={`for ${row.buyer}`} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: '10.5rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={ORDER_STATUS_LABELS}
        tones={ORDER_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'awb',
    header: 'AWB',
    width: '9.5rem',
    render: (row) =>
      row.awb ? (
        <span className="tabular text-xs text-ink-muted">{row.awb}</span>
      ) : (
        <span className="text-2xs text-ink-faint">not generated</span>
      ),
  },
  {
    key: 'ageHours',
    header: 'Age',
    width: '5.5rem',
    align: 'right',
    sortable: true,
    render: (row) => (
      <span className={`tabular text-xs ${row.ageHours > 24 ? 'font-semibold text-warning-700' : 'text-ink-muted'}`}>
        {row.ageHours}h
      </span>
    ),
  },
  {
    key: 'total',
    header: 'Value',
    width: '7rem',
    align: 'right',
    sortable: true,
    render: (row) => <MoneyCell amount={row.total} />,
  },
])

export const SUB_ORDER_FILTERS = Object.freeze([
  {
    key: 'model',
    label: 'Business model',
    options: Object.values(BUSINESS_MODEL).map((value) => ({
      value,
      label: BUSINESS_MODEL_LABELS[value],
    })),
  },
])

export const SUB_ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All sub-orders' },
  { id: 'awaiting', label: 'Awaiting vendor' },
  { id: 'in_flight', label: 'In flight' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'delivered', label: 'Delivered' },
])

export const SHIPMENT_COLUMNS = Object.freeze([
  {
    key: 'awb',
    header: 'AWB',
    width: '10rem',
    render: (row) => (
      <PrimaryCell title={row.awb} subtitle={row.courier} to={adminPath.orderDetail(row.subOrderId.slice(0, 8))} />
    ),
  },
  { key: 'seller', header: 'Seller', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'route',
    header: 'Route',
    width: '9rem',
    render: (row) => (
      <span className="tabular text-xs text-ink-muted">
        {row.pickupPincode} → {row.dropPincode}
      </span>
    ),
  },
  {
    key: 'lastEvent',
    header: 'Last scan',
    render: (row) => <PrimaryCell title={row.lastEvent} subtitle={row.lastEventAt} />,
  },
  {
    key: 'promisedBy',
    header: 'Promised',
    width: '7rem',
    render: (row) => (
      <span className={`text-xs ${row.isLate ? 'font-semibold text-danger-700' : 'text-ink-muted'}`}>
        {row.promisedBy}
        {row.isLate && ' · late'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (row) => (
      <StatusPill
        status={row.status}
        labels={SHIPMENT_STATUS_LABELS}
        tones={SHIPMENT_STATUS_TONE}
        size="sm"
      />
    ),
  },
])

export const SHIPMENT_TABS = Object.freeze([
  { id: 'all', label: 'All shipments' },
  { id: 'in_transit', label: 'In transit' },
  { id: 'late', label: 'Running late' },
  { id: 'exception', label: 'Exceptions' },
  { id: 'delivered', label: 'Delivered' },
])

export const RTO_COLUMNS = Object.freeze([
  {
    key: 'awb',
    header: 'AWB',
    width: '10rem',
    render: (row) => <PrimaryCell title={row.awb} subtitle={row.subOrderId} />,
  },
  { key: 'seller', header: 'Seller', width: '12rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'reason',
    header: 'Reason',
    width: '11rem',
    render: (row) => (
      <Badge tone="warning" size="sm" dot>
        {REASON_LABELS[row.reason]}
      </Badge>
    ),
  },
  { key: 'initiatedAt', header: 'Initiated', width: '8rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'costBearer',
    header: 'Cost borne by',
    width: '8.5rem',
    render: (row) => (
      <Badge tone={BEARER_TONE[row.costBearer]} size="sm">
        {row.costBearer.charAt(0).toUpperCase() + row.costBearer.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'shippingCost',
    header: 'Return cost',
    width: '7rem',
    align: 'right',
    render: (row) => <MoneyCell amount={row.shippingCost} muted />,
  },
  {
    key: 'settlementReversed',
    header: 'Reconciled',
    width: '9rem',
    render: (row) => (
      <span className="flex flex-col gap-0.5 text-2xs">
        <span className={row.settlementReversed ? 'text-success-700' : 'text-warning-700'}>
          {row.settlementReversed ? '✓ Settlement reversed' : '• Settlement pending'}
        </span>
        <span className={row.stockRestored ? 'text-success-700' : 'text-warning-700'}>
          {row.stockRestored ? '✓ Stock restored' : '• Stock pending'}
        </span>
      </span>
    ),
  },
])

export const RTO_TABS = Object.freeze([
  { id: 'all', label: 'All RTO' },
  { id: 'open', label: 'Not reconciled' },
  { id: 'vendor_bears', label: 'Vendor bears cost' },
  { id: 'platform_bears', label: 'Platform bears cost' },
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

export const CANCELLATION_COLUMNS = Object.freeze([
  {
    key: 'subOrderId',
    header: 'Sub-order',
    width: '9.5rem',
    render: (row) => <IdCell id={row.subOrderId} to={adminPath.orderDetail(row.orderId)} />,
  },
  {
    key: 'cancelledBy',
    header: 'Cancelled by',
    width: '8rem',
    render: (row) => (
      <Badge tone={row.cancelledBy === 'admin' ? 'accent' : 'neutral'} size="sm">
        {row.cancelledBy.charAt(0).toUpperCase() + row.cancelledBy.slice(1)}
      </Badge>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (row) => <PrimaryCell title={row.reason} subtitle={row.actor} />,
  },
  { key: 'cancelledAt', header: 'When', width: '11rem', cellClassName: 'text-xs text-ink-muted' },
  {
    key: 'refundStatus',
    header: 'Refund',
    width: '9rem',
    render: (row) => (
      <StatusPill
        status={row.refundStatus}
        labels={REFUND_STATUS_LABELS}
        tones={REFUND_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'refundAmount',
    header: 'Amount',
    width: '7rem',
    align: 'right',
    render: (row) =>
      row.refundAmount === 0 ? (
        <span className="text-2xs text-ink-faint">—</span>
      ) : (
        <MoneyCell amount={row.refundAmount} />
      ),
  },
])

export const CANCELLATION_TABS = Object.freeze([
  { id: 'all', label: 'All cancellations' },
  { id: 'refund_open', label: 'Refund open' },
  { id: 'buyer', label: 'By buyer' },
  { id: 'vendor', label: 'By vendor' },
  { id: 'admin', label: 'By admin' },
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
