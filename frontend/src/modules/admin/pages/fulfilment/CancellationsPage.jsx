import { useMemo } from 'react'
import { withRowActions } from '../../tableColumns/rowActions'
import { cancellationRowActions } from '../../lib/fulfilmentActions'
import { useCancellationWriteController } from '../../controllers/useFulfilmentController'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useCancellationListController } from '../../controllers/useFulfilmentController'
import { CANCELLATION_COLUMNS, CANCELLATION_TABS } from '../../tableColumns/fulfilmentColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

export function CancellationsPage() {
  const list = useCancellationListController()
  const writer = useCancellationWriteController()
  const columns = useMemo(
    () => withRowActions(CANCELLATION_COLUMNS, cancellationRowActions({ refund: (row) => writer.refund.run({ id: row.id }) })),
    [writer.refund],
  )
  const openRefunds = list.tabCounts.refund_open || 0

  return (
    <ListScreen
      title="Cancellations"
      description="Buyer, vendor and admin cancellations, and the refund each one owes."
      actions={<ExportMenu onExport={() => downloadTableCsv('cancellations.csv', CANCELLATION_COLUMNS, list.items)} />}
      banner={
        openRefunds > 0 && (
          <InlineAlert tone="danger" title={`${openRefunds} refunds are not yet settled`}>
            Cancelling one sub-order refunds only its share and reverses only its Route transfer —
            the siblings under the same payment are untouched.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns}
      tabs={CANCELLATION_TABS}
      searchPlaceholder="Sub-order, order or who cancelled…"
      itemLabel="cancellations"
      emptyIcon="close"
      emptyTitle="No cancellations in this view"
    />
  )
}
