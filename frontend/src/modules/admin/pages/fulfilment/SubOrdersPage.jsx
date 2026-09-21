import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { Textarea } from '../../../../components/ui'
import {
  useSubOrderListController,
  useSubOrderWriteController,
} from '../../controllers/useFulfilmentController'
import { withRowActions } from '../../tableColumns/rowActions'
import { subOrderRowActions } from '../../lib/fulfilmentActions'
import {
  SUB_ORDER_COLUMNS,
  SUB_ORDER_FILTERS,
  SUB_ORDER_TABS,
} from '../../tableColumns/fulfilmentColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

// The operational queue. A parent order is what the buyer sees; a sub-order
// is what somebody actually has to pack, and it is the unit of work here.
export function SubOrdersPage() {
  const navigate = useNavigate()
  const list = useSubOrderListController()
  const stale = list.items.filter((row) => row.ageHours > 24).length
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState('')
  const writer = useSubOrderWriteController({ onDone: () => setCancelling(null) })

  const advance = (row) => writer.advance.run({ id: row.id })

  const columns = useMemo(
    () =>
      withRowActions(
        SUB_ORDER_COLUMNS,
        subOrderRowActions({
          open: (row) => navigate(adminPath.orderDetail(row.orderId)),
          advance,
          onCancel: setCancelling,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, writer.advance],
  )

  return (
    <>
      <ListScreen
      title="Sub-orders"
      description={`${list.totalItems} sub-orders — one per vendor bucket, each with its own lifecycle`}
      actions={<ExportMenu onExport={() => downloadTableCsv('sub-orders.csv', SUB_ORDER_COLUMNS, list.items)} />}
      banner={
        stale > 0 && (
          <InlineAlert tone="warning" title={`${stale} sub-orders are older than 24 hours`}>
            Vendors have an acceptance window before an order is reassigned. These are past it.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns}
      filters={SUB_ORDER_FILTERS}
      tabs={SUB_ORDER_TABS}
      searchPlaceholder="Sub-order, order, seller or AWB…"
      onRowClick={(row) => navigate(adminPath.orderDetail(row.orderId))}
      selectable
      bulkLabel="sub-orders selected"
      bulkActions={[
        {
          label: 'Advance one step',
          icon: 'check',
          onClick: () => {
            list.items
              .filter((row) => list.selectedKeys.includes(row.id))
              .forEach((row) => advance(row))
            list.setSelectedKeys([])
          },
        },
      ]}
      itemLabel="sub-orders"
      emptyIcon="orders"
      emptyTitle="No sub-orders in this view"
      />

      <ConfirmDialog
        isOpen={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title={`Cancel ${cancelling?.id}?`}
        description="Only a sub-order that has not been handed to a courier can be cancelled here. A refund row is raised automatically."
        confirmLabel="Cancel sub-order"
        isSubmitting={writer.cancel.isSubmitting}
        onConfirm={() => writer.cancel.run({ id: cancelling.id, reason })}
      >
        <Textarea
          id="cancel-reason"
          label="Reason"
          rows={3}
          required
          placeholder="Out of stock at pickup, buyer request, risk flag…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </ConfirmDialog>
    </>
  )
}
