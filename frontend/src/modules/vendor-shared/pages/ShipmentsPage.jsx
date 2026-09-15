import { useState } from 'react'
import { Badge, Input, Skeleton } from '../../../components/ui'
import { useVendorOrdersController } from '../controllers/useVendorController'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'

// "Ready to ship" = items already PROCESSING, waiting for the seller to hand
// them to a courier — see VendorOrderDrawer for the actual "mark shipped +
// tracking number" action, reused from the Orders page.
export function ShippingPage() {
  const { items, isLoading } = useVendorOrdersController()
  const [searchTerm, setSearchTerm] = useState('')

  const toShip = items.filter((order) => order.items.some((i) => i.status === 'PROCESSING' || i.status === 'SHIPPED'))
  const term = searchTerm.toLowerCase()
  const filtered = toShip.filter((order) => order.id.toLowerCase().includes(term) || order.customer.name.toLowerCase().includes(term))

  return (
    <PageBody>
      <PageHeader title="Shipping" description="Orders that are processing or shipped. Open an order to add tracking and mark it shipped." />

      <div className="mb-4 max-w-sm">
        <Input placeholder="Search by order ID or customer…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing to ship right now</p>
          <p className="mt-1 text-xs text-ink-subtle">Orders move here once you start processing them from the Orders page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((order) => (
            <div key={order.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-slate-900">{order.id.slice(-8).toUpperCase()}</span>
                <Badge tone="brand" size="sm">{order.status}</Badge>
              </div>
              <div className="text-xs text-ink-subtle">
                {order.customer.name} · {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}
              </div>
              {order.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between border-t border-border pt-2 text-xs">
                  <span className="text-slate-900 font-medium">{item.name} × {item.quantity}</span>
                  <span className="font-mono text-2xs text-brand-600">{item.trackingNumber || `Status: ${item.status}`}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </PageBody>
  )
}
