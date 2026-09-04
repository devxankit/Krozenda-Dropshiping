import { ADMIN_PERMISSIONS } from '../constants'
import { nextSubOrderStatus } from '../fixtures/fulfilment'

// Row action sets for the fulfilment lists. Kept out of the pages so each
// screen stays the size of a screen, and so the "what can this row do next"
// rule lives in one place.

const MANAGE = ADMIN_PERMISSIONS.ORDERS_MANAGE
const CANCEL = ADMIN_PERMISSIONS.ORDERS_CANCEL
const RETURNS = ADMIN_PERMISSIONS.RETURNS_MANAGE

const pretty = (status) => String(status).replace(/_/g, ' ')

export const subOrderRowActions = ({ open, advance, onCancel }) => (row) => {
  const next = nextSubOrderStatus(row.status)
  return [
    { label: 'Open', icon: 'externalLink', onSelect: () => open(row) },
    {
      label: next ? `Mark ${pretty(next)}` : 'No further step',
      icon: 'check',
      permission: MANAGE,
      disabled: !next,
      onSelect: () => advance(row),
    },
    {
      label: 'Cancel sub-order',
      icon: 'close',
      tone: 'danger',
      permission: CANCEL,
      onSelect: () => onCancel(row),
    },
  ]
}

export const shipmentRowActions = ({ update }) => (row) => [
  {
    label: 'Mark out for delivery',
    icon: 'shipments',
    permission: MANAGE,
    disabled: row.status !== 'in_transit',
    onSelect: () => update(row, 'out_for_delivery', 'Out for delivery'),
  },
  {
    label: 'Mark delivered',
    icon: 'check',
    permission: MANAGE,
    disabled: row.status === 'delivered' || row.status.startsWith('rto'),
    onSelect: () => update(row, 'delivered', 'Delivered to consignee'),
  },
]

export const rtoRowActions = ({ restock }) => (row) => [
  {
    label: 'Take back into stock',
    icon: 'inventory',
    permission: MANAGE,
    disabled: row.stockRestored,
    onSelect: () => restock(row),
  },
]

export const returnRowActions = ({ open, decide, onReject }) => (row) => {
  const pending = row.status === 'awaiting_review'
  return [
    { label: 'Open', icon: 'externalLink', onSelect: () => open(row) },
    { label: 'Refund buyer', icon: 'money', permission: RETURNS, disabled: !pending, onSelect: () => decide(row, 'refund') },
    { label: 'Issue replacement', icon: 'refresh', permission: RETURNS, disabled: !pending, onSelect: () => decide(row, 'replace') },
    { label: 'Reject return', icon: 'close', tone: 'danger', permission: RETURNS, disabled: !pending, onSelect: () => onReject(row) },
  ]
}

export const cancellationRowActions = ({ refund }) => (row) => [
  {
    label: 'Pay the refund',
    icon: 'money',
    permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
    disabled: row.refundStatus === 'completed' || row.refundStatus === 'not_required',
    onSelect: () => refund(row),
  },
]

export const invoiceRowActions = ({ open, onVoid }) => (row) => [
  { label: 'Open invoice', icon: 'externalLink', onSelect: () => open(row) },
  {
    label: 'Void invoice',
    icon: 'close',
    tone: 'danger',
    permission: ADMIN_PERMISSIONS.FINANCE_MANAGE,
    disabled: row.voided,
    onSelect: () => onVoid(row),
  },
]
