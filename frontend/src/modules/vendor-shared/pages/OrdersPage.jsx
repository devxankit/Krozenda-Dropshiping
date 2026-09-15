import { useState } from 'react'
import { Button } from '../../../components/ui'
import { ListScreen } from '../../admin/components/data/ListScreen'
import { useVendorOrdersController } from '../controllers/useVendorController'
import { VENDOR_ORDER_COLUMNS, VENDOR_ORDER_TABS } from '../tableColumns/vendorColumns'
import { VendorOrderDrawer } from '../components/modals/VendorOrderDrawer'

export function OrdersPage() {
  const controller = useVendorOrdersController()
  const [selectedOrder, setSelectedOrder] = useState(null)

  return (
    <div className="flex flex-col gap-6">
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
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onUpdateItemStatus={controller.updateItemStatus}
      />
    </div>
  )
}
