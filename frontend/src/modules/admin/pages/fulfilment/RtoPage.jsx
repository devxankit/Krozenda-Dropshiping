import { useMemo } from 'react'
import { withRowActions } from '../../tableColumns/rowActions'
import { rtoRowActions } from '../../lib/fulfilmentActions'
import { useRtoWriteController } from '../../controllers/useFulfilmentController'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useRtoListController } from '../../controllers/useFulfilmentController'
import { RTO_COLUMNS, RTO_TABS } from '../../tableColumns/fulfilmentColumns'

// RTO is not a return. The platform's no-return policy does not cover a
// consignment that never reached the buyer, so this is its own workflow with
// its own cost bearer, settlement reversal and stock restoration.
export function RtoPage() {
  const list = useRtoListController()
  const writer = useRtoWriteController()
  const columns = useMemo(
    () => withRowActions(RTO_COLUMNS, rtoRowActions({ restock: (row) => writer.restock.run({ id: row.id }) })),
    [writer.restock],
  )
  const open = list.tabCounts.open || 0

  return (
    <ListScreen
      title="Return to origin"
      description="Consignments coming back undelivered — who bears the cost, and what still needs reconciling."
      actions={<ExportMenu onExport={() => {}} />}
      banner={
        open > 0 && (
          <InlineAlert tone="warning" title={`${open} RTO cases are not fully reconciled`}>
            An RTO closes only once the vendor settlement is reversed and, for own stock and
            marketplace, the inventory is restored. Dropshipping stock never returns to us.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns}
      tabs={RTO_TABS}
      searchPlaceholder="AWB, sub-order or seller…"
      itemLabel="RTO cases"
      emptyIcon="returns"
      emptyTitle="No RTO cases in this view"
    />
  )
}
