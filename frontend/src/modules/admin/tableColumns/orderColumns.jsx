import { adminPath } from '../../../config/routes'
import {
  ORDER_FLOW_STATUS,
  ORDER_FLOW_STATUS_LABELS,
  ORDER_FLOW_STATUS_TONE,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_TONE,
} from '../constants'
import { DateCell, IdCell, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA. A list screen
// imports these; it never builds a <th> or a status ternary itself.

export const ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Order',
    width: '9rem',
    sortable: true,
    render: (order) => <IdCell id={order.id.slice(-8).toUpperCase()} to={adminPath.orderDetail(order.id)} />,
  },
  {
    key: 'createdAt',
    header: 'Placed',
    width: '7.5rem',
    sortable: true,
    render: (order) => <DateCell value={order.createdAt} />,
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (order) => (
      <PrimaryCell
        title={order.customer.mobileNumber || order.customer.email || 'Guest'}
        subtitle={order.customer.name || 'Guest'}
      />
    ),
  },
  {
    key: 'items',
    header: 'Items',
    width: '5rem',
    align: 'right',
    cellClassName: 'tabular',
    render: (order) => order.items.reduce((sum, item) => sum + item.quantity, 0),
  },
  {
    key: 'paymentMethod',
    header: 'Payment',
    width: '9rem',
    render: (order) => (
      <span className="flex flex-col gap-1">
        <StatusPill
          status={order.paymentStatus}
          labels={ORDER_PAYMENT_STATUS_LABELS}
          tones={ORDER_PAYMENT_STATUS_TONE}
          size="sm"
        />
        <span className="text-2xs text-ink-faint">{ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '9rem',
    render: (order) => (
      <StatusPill
        status={order.status}
        labels={ORDER_FLOW_STATUS_LABELS}
        tones={ORDER_FLOW_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'total',
    header: 'Total',
    width: '7rem',
    align: 'right',
    sortable: true,
    render: (order) => <MoneyCell amount={order.total} />,
  },
])

export const ORDER_FILTERS = Object.freeze([
  {
    key: 'status',
    label: 'Status',
    options: Object.values(ORDER_FLOW_STATUS).map((value) => ({
      value,
      label: ORDER_FLOW_STATUS_LABELS[value],
    })),
  },
  {
    key: 'paymentStatus',
    label: 'Payment',
    options: Object.values(ORDER_PAYMENT_STATUS).map((value) => ({
      value,
      label: ORDER_PAYMENT_STATUS_LABELS[value],
    })),
  },
])

export const ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
])
