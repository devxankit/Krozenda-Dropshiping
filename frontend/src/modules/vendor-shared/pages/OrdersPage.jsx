import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ListScreen } from '../../admin/components/data/ListScreen'
import { useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_ORDER_COLUMNS, VENDOR_ORDER_TABS } from '../tableColumns/vendorColumns'
import { VendorOrderDrawer } from '../components/modals/VendorOrderDrawer'
import { CreateShipmentDrawer } from '../components/shipping/CreateShipmentDrawer'
import { ShipmentDrawer } from '../components/shipping/ShipmentDrawer'

export function OrdersPage() {
  const controller = useVendorOrdersController()
  const [selectedOrder, setSelectedOrder] = useState(null)
  // The shipping drawers are rendered here rather than inside the order
  // drawer, so the two never nest and each owns its own open/close state.
  const [shippingOrderId, setShippingOrderId] = useState(null)
  const [openShipmentId, setOpenShipmentId] = useState(null)

  return (
    <div className="flex flex-col gap-3">
      <ListScreen
        title="Orders"
        description="Orders containing your products. Move each item through processing, shipping and delivery."
        columns={VENDOR_ORDER_COLUMNS}
        tabs={VENDOR_ORDER_TABS}
        controller={controller}
        onRowClick={(row) => setSelectedOrder(row)}
        itemLabel="orders"
        emptyIcon="orders"
        emptyTitle="No orders yet"
        emptyDescription="Orders for your products will show up here."
        renderRowActions={(row) => (
          <Button size="xs" variant="secondary" onClick={() => setSelectedOrder(row)}>
            Manage
          </Button>
        )}
      />

      <VendorOrderDrawer
        order={selectedOrder}
        isOpen={Boolean(selectedOrder) && !shippingOrderId && !openShipmentId}
        onClose={() => setSelectedOrder(null)}
        // The drawer shows a snapshot of the row it was opened from; after a
        // move it must show the order the server sent back, or it keeps
        // offering "Start Processing" on a line that is already processing.
        onUpdateItemStatus={async (...args) => {
          const updated = await controller.updateItemStatus(...args)
          if (updated) setSelectedOrder(updated)
          return updated
        }}
        onCreateShipment={(order) => setShippingOrderId(order.orderId || order.id)}
        onOpenShipment={(id) => setOpenShipmentId(id)}
      />

      <CreateShipmentDrawer
        orderId={shippingOrderId}
        isOpen={Boolean(shippingOrderId)}
        onClose={() => setShippingOrderId(null)}
        // Straight into the new parcel, which is where the next action
        // (assign AWB) lives.
        onCreated={(shipment) => setOpenShipmentId(shipment.id)}
      />

      <ShipmentDrawer
        shipmentId={openShipmentId}
        isOpen={Boolean(openShipmentId)}
        onClose={() => setOpenShipmentId(null)}
      />
    </div>
  )
}
