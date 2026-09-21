import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert, PermissionGate } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useDropshipOrdersController } from '../../controllers/useDropshippingController'
import {
  FORWARDED_ORDER_COLUMNS,
  FORWARDED_ORDER_FILTERS,
  FORWARDED_ORDER_TABS,
} from '../../tableColumns/dropshippingColumns'
import { ReassignOrderModal } from '../../components/dropshipping/ReassignOrderModal'
import { downloadTableCsv } from '../../lib/exportCsv'

export function DropshippingOrdersPage() {
  const list = useDropshipOrdersController()
  const [selectedOrder, setSelectedOrder] = useState(null)

  const awaiting = list.items.filter((row) => row.forwardingStatus === 'auto_assigned').length

  return (
    <>
      <ListScreen
        title="Auto-Forwarded Sub-Orders"
        description="Customer order buckets auto-routed to Model A dropshipping partners for packing, shipment and AWB tracking."
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('forwarded-sub-orders.csv', FORWARDED_ORDER_COLUMNS, list.items)} />
            <PermissionGate permission={ADMIN_PERMISSIONS.ORDERS_MANAGE}>
              <Button size="control" icon="refresh" onClick={() => list.refetch?.()}>
                Auto-assign queue
              </Button>
            </PermissionGate>
          </>
        }
        banner={
          awaiting > 0 && (
            <InlineAlert tone="info" title={`${awaiting} sub-orders awaiting supplier acceptance`}>
              Orders are auto-assigned upon payment verification. If a supplier rejects, Admin receives an alert to re-assign or re-route to alternate supplier stock.
            </InlineAlert>
          )
        }
        controller={list}
        columns={FORWARDED_ORDER_COLUMNS}
        filters={FORWARDED_ORDER_FILTERS}
        tabs={FORWARDED_ORDER_TABS}
        searchPlaceholder="Sub-order ID, parent order, buyer or supplier…"
        itemLabel="forwarded sub-orders"
        emptyIcon="orders"
        emptyTitle="No forwarded sub-orders match these filters"
        onRowClick={(row) => setSelectedOrder(row)}
      />

      <ReassignOrderModal
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onReassign={list.reassignOrder}
      />
    </>
  )
}
