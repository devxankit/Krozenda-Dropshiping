import { useState } from 'react'
import { Badge, Button, Input, Skeleton } from '../../../components/ui'
import { useVendorOrdersController } from '../controllers/useVendorController'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'

export function ShipmentsPage() {
  const { items, isLoading } = useVendorOrdersController()
  const [searchTerm, setSearchTerm] = useState('')

  const shippedOrders = items.filter(
    (item) => item.awb || item.forwardingStatus === 'shipped' || item.forwardingStatus === 'packed',
  )

  const filteredShipments = shippedOrders.filter(
    (order) =>
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.awb && order.awb.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <PageBody>
      <PageHeader
        title="Shipments & Logistics"
        subtitle="Track automated Shiprocket AWBs, courier manifest status, and package handovers."
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Print Manifest
            </Button>
          </div>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by Sub-Order ID, Customer, or AWB..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : filteredShipments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm font-medium text-slate-700">No active shipments found</p>
          <p className="mt-1 text-xs text-ink-subtle">
            When you accept orders and generate AWBs, they will appear here for logistics tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredShipments.map((shipment) => (
            <div
              key={shipment.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-xs md:flex-row md:items-center md:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-900">{shipment.id}</span>
                  <Badge tone={shipment.forwardingStatus === 'shipped' ? 'success' : 'brand'} size="sm">
                    {shipment.forwardingStatus === 'shipped' ? 'In Transit' : 'Manifested & Packed'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-900">{shipment.productName}</span> (Qty: {shipment.quantity})
                </div>
                <div className="text-2xs text-ink-subtle">
                  Recipient: <span className="font-medium text-slate-700">{shipment.customerName}</span> · {shipment.shippingAddress}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 md:border-t-0 md:pt-0">
                <div className="flex flex-col text-right text-xs">
                  <span className="text-2xs uppercase tracking-wider text-ink-faint font-semibold">Courier Partner</span>
                  <span className="font-medium text-slate-900">Shiprocket Direct</span>
                  <span className="font-mono text-2xs text-brand-600">{shipment.awb || 'Generating AWB...'}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() =>
                      alert(`Tracking shipment ${shipment.id} via Shiprocket API: Live status IN_TRANSIT (Hub: Delhi)`)
                    }
                  >
                    Track Live
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => alert(`Downloading shipping label PDF for AWB: ${shipment.awb}`)}
                  >
                    Download Label
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageBody>
  )
}
