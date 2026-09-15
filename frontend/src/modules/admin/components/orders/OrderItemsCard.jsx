import { Table } from '../../../../components/ui'
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

export function OrderItemsCard({ items }) {
  return (
    <SectionCard title="Items">
      <div className="p-4">
        <Table columns={ITEM_COLUMNS} data={items} getRowKey={(item, index) => `${item.productId}-${index}`} density="compact" />
      </div>
    </SectionCard>
  )
}
