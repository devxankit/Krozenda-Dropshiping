import { Badge, Button, Table } from '../../../../components/ui'
import { BUSINESS_MODEL_LABELS, ORDER_STATUS_LABELS } from '../../../../config/constants'
import { BUSINESS_MODEL_SERIES, ORDER_STATUS_TONE } from '../../constants'
import { MoneyCell, SectionCard, Timeline } from '../display'

const SERIES_DOT = Object.freeze({ 1: 'bg-chart-1', 2: 'bg-chart-2', 3: 'bg-chart-3' })

const ITEM_COLUMNS = Object.freeze([
  {
    key: 'name',
    header: 'Item',
    render: (item) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-slate-900">{item.name}</span>
        <span className="tabular block text-2xs text-ink-faint">
          {item.sku} · HSN {item.hsn} · GST {item.gstRate}%
        </span>
      </span>
    ),
  },
  {
    key: 'quantity',
    header: 'Qty',
    width: '3.5rem',
    align: 'right',
    cellClassName: 'tabular',
  },
  {
    key: 'unitPrice',
    header: 'Unit price',
    width: '6.5rem',
    align: 'right',
    render: (item) => <MoneyCell amount={item.unitPrice} muted />,
  },
  {
    key: 'lineTotal',
    header: 'Line total',
    width: '6.5rem',
    align: 'right',
    render: (item) => <MoneyCell amount={item.lineTotal} />,
  },
])

function TotalRow({ label, amount, strong = false, note }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 text-xs ${strong ? 'border-t border-border pt-2 font-semibold' : ''}`}
    >
      <span className={strong ? 'text-slate-900' : 'text-ink-subtle'}>
        {label}
        {note && <span className="ml-1 text-2xs text-ink-faint">{note}</span>}
      </span>
      <MoneyCell amount={amount} muted={!strong} />
    </div>
  )
}

// One sub-order: its own vendor, status, shipment, commission snapshot and
// lifecycle. Cancelling this one must not touch its siblings, which is why it
// is a self-contained card rather than a row in the parent's item list.
export function SubOrderCard({ subOrder }) {
  const series = BUSINESS_MODEL_SERIES[subOrder.model]

  return (
    <SectionCard
      title={
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="tabular text-sm font-semibold text-slate-900">{subOrder.id}</span>
          <span className="flex items-center gap-1.5 text-xs font-normal text-ink-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${SERIES_DOT[series]}`} />
            {BUSINESS_MODEL_LABELS[subOrder.model]}
          </span>
          <span className="text-ink-faint">·</span>
          <span className="text-xs font-medium text-ink-muted">{subOrder.seller.name}</span>
        </span>
      }
      actions={
        <>
          <Badge tone={ORDER_STATUS_TONE[subOrder.status] || 'neutral'} dot>
            {ORDER_STATUS_LABELS[subOrder.status] || subOrder.status}
          </Badge>
          <Button variant="secondary" size="sm" icon="more" iconOnly aria-label="Sub-order actions" />
        </>
      }
    >
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <Table
            columns={ITEM_COLUMNS}
            data={subOrder.items}
            getRowKey={(item) => item.id}
            density="compact"
          />

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Money
              </p>
              <div className="mt-1">
                <TotalRow label="Subtotal" amount={subOrder.subtotal} />
                <TotalRow label="GST" amount={subOrder.tax} />
                <TotalRow label="Shipping" amount={subOrder.shipping} />
                <TotalRow label="Sub-order total" amount={subOrder.total} strong />
              </div>
            </div>

            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Commission snapshot
              </p>
              <div className="mt-1">
                <TotalRow
                  label={`${subOrder.commission.value}% commission`}
                  amount={subOrder.commission.amount}
                  note={`from ${subOrder.commission.resolvedFrom}`}
                />
                <TotalRow label="Net to vendor" amount={subOrder.settlement.net} strong />
              </div>
              <p className="mt-1.5 text-2xs leading-snug text-ink-faint">
                Rate captured when the order was placed. It is never recomputed from the current
                rule set.
              </p>
            </div>
          </div>

          {subOrder.shipment?.awb && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-surface-muted px-3 py-2 text-xs">
              <span className="text-ink-subtle">AWB</span>
              <span className="tabular font-semibold text-slate-900">{subOrder.shipment.awb}</span>
              <span className="text-ink-subtle">{subOrder.shipment.courier}</span>
              <span className="text-ink-faint">
                Pickup {subOrder.shipment.pickupPincode}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="mb-3 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Lifecycle
          </p>
          <Timeline events={subOrder.timeline} />
        </div>
      </div>
    </SectionCard>
  )
}
