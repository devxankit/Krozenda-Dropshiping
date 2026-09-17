import { useState } from 'react'
import { Badge, Button } from '../../../../components/ui'
import { InlineAlert } from '../../components/feedback'
import { ListScreen } from '../../components/data/ListScreen'
import { ADMIN_SHIPMENT_COLUMNS } from '../../../vendor-shared/tableColumns/shipmentColumns'
import { SHIPMENT_TABS } from '../../../vendor-shared/controllers/useShippingController'
import { ShipmentDrawer } from '../../../vendor-shared/components/shipping/ShipmentDrawer'
import {
  useAdminShipmentsController,
  useCarrierAccountsController,
  useShippingOverviewController,
} from '../../controllers/useShippingController'
import { integrationStatusPresentation } from '../../../../lib/shipping/presentation'

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
        title="Carrier shipments"
        description="Parcels booked with Shiprocket, across every seller. Open one to see its tracking and history."
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

// Admin > Fulfilment > Carrier accounts: which sellers ship on their own
// account, and whose is failing.
//
// Read-only on purpose. An admin cannot test, edit or re-authenticate a
// seller's account, because doing so would mean handling that seller's
// credentials (task §4, §7). The only account an admin can act on is the
// platform's, from Settings > Logistics.
export function CarrierAccountsPage() {
  const controller = useCarrierAccountsController()

  return (
    <ListScreen
      title="Carrier accounts"
      description="Sellers shipping on their own Shiprocket account, and the health of each connection."
      banner={
        <InlineAlert tone="info" title="Read-only">
          A seller&apos;s carrier credentials are theirs. This screen shows whether a connection works — never the
          account email, password or token. If one is failing, ask the seller to reconnect it from their panel.
        </InlineAlert>
      }
      controller={controller}
      columns={CARRIER_ACCOUNT_COLUMNS}
      tabs={[
        { id: 'all', label: 'All' },
        { id: 'seller', label: 'Seller accounts' },
        { id: 'platform', label: 'Platform' },
      ]}
      searchPlaceholder="Search sellers…"
      itemLabel="accounts"
      emptyIcon="integrations"
      emptyTitle="No carrier accounts"
      emptyDescription="Accounts appear here once a seller connects one, or once the platform account is first used."
    />
  )
}

const CARRIER_ACCOUNT_COLUMNS = Object.freeze([
  {
    key: 'owner',
    header: 'Account',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-900">{row.vendorName || row.accountLabel}</span>
        {/* Masked, and only ever masked — enough for support to tell two
            accounts apart on a call, not enough to be a contact list. */}
        <span className="font-mono text-2xs text-ink-subtle">{row.maskedEmail}</span>
      </div>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    width: '10rem',
    render: (row) => (
      <Badge tone={row.accountType === 'SELLER' ? 'accent' : 'neutral'} size="sm">
        {row.accountLabel}
      </Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '12rem',
    render: (row) => {
      const presentation = integrationStatusPresentation(row.status)
      return (
        <div className="flex flex-col gap-1">
          <Badge tone={row.isActive ? presentation.tone : 'neutral'} size="sm" dot>
            {row.isActive ? presentation.label : 'Disconnected'}
          </Badge>
          {row.consecutiveFailures > 0 && (
            <span className="text-2xs text-danger-600">{row.consecutiveFailures} failures in a row</span>
          )}
        </div>
      )
    },
  },
  {
    key: 'lastFailure',
    header: 'Last failure',
    render: (row) => (
      // Already a safe, generic message from the backend — never the carrier's
      // raw response, and never anything echoing a credential.
      <span className="text-2xs text-ink-subtle">{row.failureReason || '—'}</span>
    ),
  },
])
