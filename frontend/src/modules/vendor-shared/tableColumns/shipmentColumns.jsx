import { Badge } from '../../../components/ui'
import { DateCell } from '../../admin/components/display/cells'
import { formatCarrierRupees, shipmentStatusPresentation } from '../../../lib/shipping/presentation'

// Columns for the shipment list, shared between the seller and admin panels.
// The admin variant adds a "shipped on" column naming the ACCOUNT TYPE only —
// never the seller's carrier email, which task §18 keeps off admin screens.

// A render helper, not a component: defining it as one in a columns file
// breaks fast refresh, and it is only ever called from the column below.
function renderStatus(row) {
  const presentation = shipmentStatusPresentation(row.status)
  return (
    <div className="flex flex-col gap-1">
      <Badge tone={presentation.tone} size="sm" dot>
        {presentation.label}
      </Badge>
      {/* The carrier's own wording, for support conversations. It never drives
          any logic here — `row.status` does. */}
      {row.carrierStatus && row.carrierStatus !== presentation.label && (
        <span className="text-2xs text-ink-faint">{row.carrierStatus}</span>
      )}
    </div>
  )
}

const BASE_COLUMNS = [
  {
    key: 'shipment',
    header: 'Shipment',
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs font-semibold text-slate-900">{row.id.slice(-8).toUpperCase()}</span>
        <span className="text-2xs text-ink-subtle">
          Order {row.orderId.slice(-8).toUpperCase()} · {row.itemCount} item{row.itemCount === 1 ? '' : 's'}
        </span>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '11rem',
    render: renderStatus,
  },
  {
    key: 'courier',
    header: 'Courier / AWB',
    width: '12rem',
    render: (row) =>
      row.awbCode ? (
        <div className="flex flex-col">
          <span className="text-xs text-slate-900">{row.courierName || 'Assigned'}</span>
          <span className="font-mono text-2xs text-ink-subtle">{row.awbCode}</span>
        </div>
      ) : (
        <span className="text-2xs text-ink-faint">Not assigned</span>
      ),
  },
  {
    key: 'route',
    header: 'Route',
    width: '10rem',
    render: (row) => (
      <div className="flex flex-col text-2xs text-ink-subtle">
        <span>{row.pickupLocation || row.pickupPincode || '—'}</span>
        <span>
          → {row.deliveryCity || '—'} {row.deliveryPincode}
        </span>
      </div>
    ),
  },
  {
    key: 'payment',
    header: 'Payment',
    width: '8rem',
    align: 'right',
    render: (row) => (
      <div className="flex flex-col items-end">
        <Badge tone={row.paymentMethod === 'COD' ? 'warning' : 'neutral'} size="sm">
          {row.paymentMethod}
        </Badge>
        {row.paymentMethod === 'COD' && row.collectableAmount > 0 && (
          <span className="tabular mt-1 text-2xs text-ink-subtle">
            collect {formatCarrierRupees(row.collectableAmount)}
          </span>
        )}
      </div>
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    width: '8rem',
    render: (row) => <DateCell value={row.createdAt} />,
  },
]

export const SELLER_SHIPMENT_COLUMNS = Object.freeze(BASE_COLUMNS)

export const ADMIN_SHIPMENT_COLUMNS = Object.freeze([
  ...BASE_COLUMNS.slice(0, 2),
  {
    key: 'account',
    header: 'Shipped on',
    width: '9rem',
    render: (row) => (
      // Account TYPE only. An admin needs to know whose account was billed,
      // not which email logged in (task §18).
      <Badge tone={row.shippingAccountType === 'SELLER' ? 'accent' : 'neutral'} size="sm">
        {row.shippingAccountType === 'SELLER' ? 'Seller account' : row.shippingAccountType === 'PLATFORM' ? 'Platform account' : '—'}
      </Badge>
    ),
  },
  ...BASE_COLUMNS.slice(2),
])
