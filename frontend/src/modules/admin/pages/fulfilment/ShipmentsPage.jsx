import { useMemo } from 'react'
import { withRowActions } from '../../tableColumns/rowActions'
import { shipmentRowActions } from '../../lib/fulfilmentActions'
import { useShipmentWriteController } from '../../controllers/useFulfilmentController'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useShipmentListController } from '../../controllers/useFulfilmentController'
import { SHIPMENT_COLUMNS, SHIPMENT_TABS } from '../../tableColumns/fulfilmentColumns'

export function ShipmentsPage() {
  const list = useShipmentListController()
  const writer = useShipmentWriteController()
  const columns = useMemo(
    () =>
      withRowActions(
        SHIPMENT_COLUMNS,
        shipmentRowActions({
          update: (row, status, lastEvent) => writer.update.run({ id: row.id, status, lastEvent }),
        }),
      ),
    [writer.update],
  )
  const late = list.tabCounts.late || 0

  return (
    <ListScreen
      title="Shipments"
      description="AWB, courier allocation and the last tracking scan received from Shiprocket."
      actions={<ExportMenu onExport={() => {}} />}
      banner={
        late > 0 && (
          <InlineAlert tone="warning" title={`${late} consignments are past their promised date`}>
            Tracking events arrive by webhook. A shipment with no scan for 48 hours is worth
            chasing with the courier before the buyer does.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns}
      tabs={SHIPMENT_TABS}
      searchPlaceholder="AWB, sub-order, seller or courier…"
      itemLabel="shipments"
      emptyIcon="shipments"
      emptyTitle="No shipments in this view"
    />
  )
}
