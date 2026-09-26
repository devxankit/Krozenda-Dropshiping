import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useReturnListController } from '../../controllers/useFulfilmentController'
import { RETURN_COLUMNS, RETURN_FILTERS, RETURN_TABS } from '../../tableColumns/fulfilmentColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

export function ReturnsPage() {
  const navigate = useNavigate()
  const list = useReturnListController()
  const waiting = list.tabCounts.awaiting_review || 0

  return (
    <ListScreen
      title="Returns"
      description="A buyer received an item and wants to return or replace it. Approve, collect it, then refund or replace. (An undelivered parcel coming back is an RTO — see Shipments.)"
      actions={<ExportMenu onExport={() => downloadTableCsv('returns.csv', RETURN_COLUMNS, list.items)} />}
      banner={
        waiting > 0 && (
          <InlineAlert tone="warning" title={`${waiting} requests are waiting on a decision`}>
            Every request needs photo evidence before it can be approved. A request with fewer than
            two photographs is flagged in the evidence column.
          </InlineAlert>
        )
      }
      controller={list}
      columns={RETURN_COLUMNS}
      filters={RETURN_FILTERS}
      tabs={RETURN_TABS}
      searchPlaceholder="Request, sub-order, buyer or seller…"
      onRowClick={(row) => navigate(adminPath.returnDetail(row.id))}
      itemLabel="requests"
      emptyIcon="returns"
      emptyTitle="No return requests in this view"
    />
  )
}
