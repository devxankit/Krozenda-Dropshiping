import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui'
import { InlineAlert } from '../../admin/components/feedback'
import { ListScreen } from '../../admin/components/data/ListScreen'
import { SELLER_SHIPMENT_COLUMNS } from '../tableColumns/shipmentColumns'
import { SHIPMENT_TABS, useShipmentsController, useShippingIntegrationController } from '../controllers/useShippingController'
import { ShipmentDrawer } from '../components/shipping/ShipmentDrawer'

// Seller > Shipping: every parcel this store has booked with a courier.
//
// This replaces the earlier screen, which listed ORDERS in a PROCESSING state
// and relied on the seller typing a tracking number in by hand. A shipment is
// now a real record with a carrier behind it, so the list shows shipments.
// Creating one starts from an order — see the Orders page — because the parcel
// is derived from the order's items, not the other way round.

export function ShippingPage() {
  const controller = useShipmentsController()
  const account = useShippingIntegrationController()
  const navigate = useNavigate()
  const [openShipmentId, setOpenShipmentId] = useState(null)

  // Relative, so the same page works under /seller and /partner without
  // knowing which prefix it is mounted at.
  const goToSettings = () => navigate('settings')

  return (
    <>
      <ListScreen
        title="Shipping"
        description="Parcels booked with a courier. Open one to assign an AWB, schedule pickup or see tracking."
        banner={<ShippingBanner account={account} controller={controller} onOpenSettings={goToSettings} />}
        actions={
          <Button variant="secondary" size="control" onClick={goToSettings}>
            Shipping settings
          </Button>
        }
        controller={controller}
        columns={SELLER_SHIPMENT_COLUMNS}
        tabs={SHIPMENT_TABS}
        searchPlaceholder="Search by AWB or order id…"
        onRowClick={(row) => setOpenShipmentId(row.id)}
        itemLabel="shipments"
        emptyIcon="truck"
        emptyTitle="No shipments here"
        emptyDescription="Shipments appear once you book a parcel from an order."
      />

      <ShipmentDrawer
        shipmentId={openShipmentId}
        isOpen={Boolean(openShipmentId)}
        onClose={() => setOpenShipmentId(null)}
      />
    </>
  )
}

// Two things worth interrupting the list for: parcels that need a human, and
// a carrier account that will refuse the next booking.
function ShippingBanner({ account, controller, onOpenSettings }) {
  const needsAttention = controller.tabCounts?.attention || 0

  if (account.effectiveAccount === 'DISABLED') {
    return (
      <InlineAlert tone="warning" title="Shipping is turned off">
        You cannot book new parcels right now. Everything already shipped stays trackable.
      </InlineAlert>
    )
  }

  if (account.effectiveAccount === 'NONE' || account.isUnhealthy) {
    return (
      <InlineAlert
        tone="danger"
        title={account.isUnhealthy ? 'Your courier account is not responding' : 'No courier account available'}
        action={
          <Button size="sm" variant="secondary" onClick={onOpenSettings}>
            Fix this
          </Button>
        }
      >
        New parcels will be refused until this is sorted out.
      </InlineAlert>
    )
  }

  if (needsAttention > 0) {
    return (
      <InlineAlert
        tone="warning"
        title={`${needsAttention} parcel${needsAttention === 1 ? '' : 's'} need attention`}
        action={
          <Button size="sm" variant="secondary" onClick={() => controller.changeTab('attention')}>
            Show them
          </Button>
        }
      >
        Failed deliveries, parcels coming back to you, or a booking that has to be checked at the courier.
      </InlineAlert>
    )
  }

  return null
}
