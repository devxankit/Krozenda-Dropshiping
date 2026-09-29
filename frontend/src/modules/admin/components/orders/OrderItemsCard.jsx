import { Badge, Button, Table } from '../../../../components/ui'
import { MoneyCell, SectionCard } from '../display'

const ITEM_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Item',
    render: (item) => (
      <span className="flex items-center gap-2 min-w-0">
        {item.image && (
          <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        )}
        <span className="block min-w-0">
          <span className="block truncate font-medium text-slate-900">{item.name}</span>
          {item.variant && <span className="block text-2xs text-ink-faint">{item.variant}</span>}
        </span>
      </span>
    ),
  },
  { key: 'quantity', header: 'Qty', width: '3.5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'price',
    header: 'Unit price',
    width: '6.5rem',
    align: 'right',
    render: (item) => <MoneyCell amount={item.price} muted />,
  },
  {
    key: 'lineTotal',
    header: 'Line total',
    width: '6.5rem',
    align: 'right',
    render: (item) => <MoneyCell amount={item.price * item.quantity} />,
  },
])

// Each line's own status, and — for a line the seller marked delivered on
// their own — the admin's "Confirm delivery", which releases it to payout.
function statusColumn({ onConfirmDelivery, confirmingId }) {
  return {
    key: 'status',
    header: 'Status',
    width: '12rem',
    render: (item) =>
      item.awaitingDeliveryConfirmation ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="warning" dot>
            Delivered · seller-marked
          </Badge>
          {onConfirmDelivery && (
            <Button
              size="xs"
              variant="secondary"
              isLoading={confirmingId === item.subOrderId}
              onClick={() => onConfirmDelivery(item)}
            >
              Confirm delivery
            </Button>
          )}
        </span>
      ) : (
        <span className="text-xs text-ink-subtle">{item.status ? item.status.charAt(0) + item.status.slice(1).toLowerCase() : '—'}</span>
      ),
  }
}

export function OrderItemsCard({ items, onConfirmDelivery, confirmingId }) {
  const hasLineStatus = items.some((item) => item.status)
  const columns = hasLineStatus ? [...ITEM_COLUMNS, statusColumn({ onConfirmDelivery, confirmingId })] : ITEM_COLUMNS
  return (
    <SectionCard title="Items">
      <div className="p-4">
        <Table columns={columns} data={items} getRowKey={(item, index) => `${item.productId}-${index}`} density="compact" />
      </div>
    </SectionCard>
  )
}
