import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useReturnListController } from '../../controllers/useFulfilmentController'
import { RETURN_COLUMNS, RETURN_FILTERS, RETURN_TABS } from '../../tableColumns/fulfilmentColumns'

export function ReturnsPage() {
  const navigate = useNavigate()
  const list = useReturnListController()
  const waiting = list.tabCounts.awaiting_review || 0

  return (
    <ListScreen
      title="Returns & replacements"
      description="The platform default is no returns. Only damaged, wrong and missing items qualify."
      actions={<ExportMenu onExport={() => {}} />}
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
