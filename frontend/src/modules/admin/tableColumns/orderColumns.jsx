import { adminPath } from '../../../config/routes'
import { BUSINESS_MODEL, BUSINESS_MODEL_LABELS } from '../../../config/constants'
import {
  BUYER_TYPE_LABELS,
  FULFILMENT_STATUS,
  FULFILMENT_STATUS_LABELS,
  FULFILMENT_STATUS_TONE,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
} from '../constants'
import { DateCell, IdCell, ModelDots, MoneyCell, PrimaryCell, StatusPill } from '../components/display'

// Rule 07: column definitions and filter schemas are DATA. A list screen
// imports these; it never builds a <th> or a status ternary itself.

export const ORDER_COLUMNS = Object.freeze([
  {
    key: 'id',
    header: 'Order',
    width: '8.5rem',
    sortable: true,
    render: (order) => <IdCell id={order.id} to={adminPath.orderDetail(order.id)} />,
  },
  {
    key: 'placedAt',
    header: 'Placed',
    width: '7.5rem',
    sortable: true,
    render: (order) => <DateCell value={order.placedAt} />,
  },
  {
    key: 'buyer',
    header: 'Customer',
    sortable: true,
    render: (order) => (
      <PrimaryCell
        title={order.buyer.name}
        subtitle={`${order.buyer.city} ${order.buyer.pincode} · ${BUYER_TYPE_LABELS[order.buyer.type]}`}
      />
    ),
  },
  {
    key: 'models',
    header: 'Sub-orders',
    width: '11rem',
    render: (order) => (
      <ModelDots
        models={order.models}
        label={`${order.sellerCount} ${order.sellerCount === 1 ? 'seller' : 'sellers'} · ${order.itemCount} ${order.itemCount === 1 ? 'item' : 'items'}`}
      />
    ),
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    width: '8rem',
    render: (order) => (
      <StatusPill
        status={order.paymentStatus}
        labels={PAYMENT_STATUS_LABELS}
        tones={PAYMENT_STATUS_TONE}
        size="sm"
      />
    ),
  },
  {
    key: 'fulfilmentStatus',
    header: 'Fulfilment',
    width: '9.5rem',
    render: (order) => (
      <StatusPill
        status={order.fulfilmentStatus}
        labels={FULFILMENT_STATUS_LABELS}
        tones={FULFILMENT_STATUS_TONE}
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
    key: 'model',
    label: 'Business model',
    options: Object.values(BUSINESS_MODEL).map((value) => ({
      value,
      label: BUSINESS_MODEL_LABELS[value],
    })),
  },
  {
    key: 'fulfilmentStatus',
    label: 'Fulfilment',
    options: Object.values(FULFILMENT_STATUS).map((value) => ({
      value,
      label: FULFILMENT_STATUS_LABELS[value],
    })),
  },
  {
    key: 'paymentStatus',
    label: 'Payment',
    options: Object.values(PAYMENT_STATUS).map((value) => ({
      value,
      label: PAYMENT_STATUS_LABELS[value],
    })),
  },
  {
    key: 'buyerType',
    label: 'Buyer type',
    options: Object.entries(BUYER_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  },
])

export const ORDER_TABS = Object.freeze([
  { id: 'all', label: 'All orders' },
  { id: 'needs_action', label: 'Needs action' },
  { id: 'unfulfilled', label: 'Unfulfilled' },
  { id: 'exceptions', label: 'RTO & returns' },
  { id: 'cancelled', label: 'Cancelled' },
])
