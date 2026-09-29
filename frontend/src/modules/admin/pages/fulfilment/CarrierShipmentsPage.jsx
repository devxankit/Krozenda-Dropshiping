import { useState } from 'react'
import { Button } from '../../../../components/ui'
import { InlineAlert } from '../../components/feedback'
import { ListScreen } from '../../components/data/ListScreen'
import { ADMIN_SHIPMENT_COLUMNS } from '../../../vendor-shared/tableColumns/shipmentColumns'
import { SHIPMENT_TABS } from '../../../vendor-shared/controllers/useShippingController'
import { ShipmentDrawer } from '../../../vendor-shared/components/shipping/ShipmentDrawer'
import { useAdminShipmentsController, useShippingOverviewController } from '../../controllers/useShippingController'

// Admin > Fulfilment > Carrier shipments: every parcel booked through the
// courier integration, across all sellers.
//
// Distinct from the older Fulfilment > Shipments screen, which lists
// hand-entered tracking numbers on order items. Both are real; this one is the
// carrier-backed record.
//
// The seller's carrier EMAIL is never shown here. The list says "Seller
// account" or "Platform account" and nothing more (task §18).

export function CarrierShipmentsPage() {
  const controller = useAdminShipmentsController()
  const overview = useShippingOverviewController()
  const [openShipmentId, setOpenShipmentId] = useState(null)

  const needsReconciliation = overview.data?.reconciliationRequired ?? 0

  return (
    <>
      <ListScreen
        title="Shipments"
        description="Every parcel with the courier (Shiprocket). Open one to assign the AWB, schedule pickup, print the label and track it. RTO = a parcel the courier could not deliver, coming back."
        banner={
          needsReconciliation > 0 ? (
            <InlineAlert
              tone="danger"
              title={`${needsReconciliation} parcel${needsReconciliation === 1 ? '' : 's'} could not be confirmed`}
              action={
                <Button size="sm" variant="secondary" onClick={() => controller.changeTab('attention')}>
                  Show them
                </Button>
              }
            >
              A carrier call timed out on {needsReconciliation === 1 ? 'this parcel' : 'these parcels'}. Each one must be
              checked in the Shiprocket panel before it is retried, or the retry creates a second real parcel.
            </InlineAlert>
          ) : null
        }
        controller={controller}
        columns={ADMIN_SHIPMENT_COLUMNS}
        tabs={SHIPMENT_TABS}
        searchPlaceholder="Search by AWB or order id…"
        onRowClick={(row) => setOpenShipmentId(row.id)}
        itemLabel="shipments"
        emptyIcon="truck"
        emptyTitle="No carrier shipments"
        emptyDescription="Parcels appear here once a seller books one with the courier."
      />

      <ShipmentDrawer
        shipmentId={openShipmentId}
        isOpen={Boolean(openShipmentId)}
        onClose={() => setOpenShipmentId(null)}
        isAdmin
      />
    </>
  )
}
