import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ListScreen } from '../../admin/components/data/ListScreen'
import { useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_ORDER_COLUMNS, VENDOR_ORDER_TABS } from '../tableColumns/vendorColumns'
import { VendorOrderDrawer } from '../components/modals/VendorOrderDrawer'

export function OrdersPage() {
  const controller = useVendorOrdersController()
  const [selectedOrder, setSelectedOrder] = useState(null)

  const handleUpdateStatus = (subOrderId, newStatus, awb) => {
    controller.updateOrderStatus(subOrderId, newStatus, awb)
    if (selectedOrder && selectedOrder.id === subOrderId) {
      setSelectedOrder((prev) => (prev ? { ...prev, forwardingStatus: newStatus, awb: awb || prev.awb } : null))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ListScreen
        title="Assigned Sub-Orders"
        subtitle="Manage order acceptance, packing list generation, and Shiprocket dispatch."
        columns={VENDOR_ORDER_COLUMNS}
        tabs={VENDOR_ORDER_TABS}
        controller={controller}
        onRowClick={(row) => setSelectedOrder(row)}
        renderRowActions={(row) => (
          <Button size="xs" variant="secondary" onClick={() => setSelectedOrder(row)}>
            Manage & Fulfill
          </Button>
        )}
      />

      {selectedOrder && (
        <VendorOrderDrawer
          order={selectedOrder}
          isOpen={Boolean(selectedOrder)}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  )
}
