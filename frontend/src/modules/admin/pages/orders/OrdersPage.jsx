import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tabs } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { DataTable, ExportMenu, FilterBar, FilterChips } from '../../components/data'
import { PermissionGate } from '../../components/feedback'
import { OrderFormModal } from '../../components/orders/OrderFormModal'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useOrderDeleteController,
  useOrderListController,
  useOrderWriteController,
} from '../../controllers/useOrderController'
import { withRowActions } from '../../tableColumns/rowActions'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { useAuthStore } from '../../../../lib/authStore'
import { ORDER_COLUMNS, ORDER_FILTERS, ORDER_TABS } from '../../tableColumns/orderColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

// Reference implementation for every list screen in the panel. The whole
// page is a controller call plus composition — the columns, the filters and
// the tabs are data, and DataTable owns the four states.
export function OrdersPage() {
  const navigate = useNavigate()
  const list = useOrderListController()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { create } = useOrderWriteController({ onSaved: () => setIsCreateOpen(false) })
  const isSuperAdmin = useAuthStore((state) => state.roles.includes('admin'))
  const [toDelete, setToDelete] = useState(null)
  const deletion = useOrderDeleteController({ onDone: () => setToDelete(null) })
  // Open, and — super admin, cancelled orders only — delete.
  const columns = withRowActions(ORDER_COLUMNS, (order) => [
    { label: 'Open', icon: 'externalLink', onSelect: () => navigate(adminPath.orderDetail(order.id)) },
    ...(isSuperAdmin && order.status === 'CANCELLED'
      ? [{ label: 'Delete order', icon: 'delete', tone: 'danger', onSelect: () => setToDelete(order) }]
      : []),
  ])

  return (
    <PageBody>
      <PageHeader
        title="Orders"
        description={`${list.totalItems.toLocaleString('en-IN')} orders · what was bought, by whom, and how it was paid. Open one for its items, parcels and invoice.`}
        actions={
          <>
            <ExportMenu onExport={() => downloadTableCsv('orders.csv', ORDER_COLUMNS, list.items)} />
            <PermissionGate permission={ADMIN_PERMISSIONS.ORDERS_MANAGE}>
              <Button size="control" icon="add" onClick={() => setIsCreateOpen(true)}>
                Create order
              </Button>
            </PermissionGate>
          </>
        }
      />

      <Tabs
        items={ORDER_TABS.map((tab) => ({ ...tab, count: list.tabCounts[tab.id] }))}
        activeId={list.tab}
        onChange={list.changeTab}
      />

      <FilterBar
        filters={ORDER_FILTERS}
        value={list.filters}
        onChange={list.changeFilters}
        searchPlaceholder="Order ID, customer or pincode…"
      />

      <FilterChips
        filters={ORDER_FILTERS}
        value={list.filters}
        onChange={list.changeFilters}
        onClear={list.clearFilters}
      />

      <DataTable
        columns={columns}
        data={list.items}
        getRowKey={(order) => order.id}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.refetch}
        sort={list.sort}
        onSortChange={list.changeSort}
        onRowClick={(order) => navigate(adminPath.orderDetail(order.id))}
        page={list.page}
        totalPages={list.totalPages}
        totalItems={list.totalItems}
        rowsPerPage={list.rowsPerPage}
        onPageChange={list.setPage}
        onRowsPerPageChange={list.changeRowsPerPage}
        itemLabel="orders"
        emptyIcon="orders"
        emptyTitle="No orders match these filters"
        emptyDescription="Try widening the date range, or clear the filters to see everything."
        emptyAction={{ label: 'Clear filters', icon: 'close', onClick: list.clearFilters }}
      />

      <OrderFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={create.run}
        isSubmitting={create.isSubmitting}
        error={create.error}
      />
      <ConfirmDialog
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => deletion.run({ id: toDelete.id })}
        isSubmitting={deletion.isSubmitting}
        title={toDelete ? `Delete order ${toDelete.id.slice(-8).toUpperCase()}?` : ''}
        description="The order, its parcels, return requests and notifications are removed for good. Only cancelled orders that were never paid can be deleted — anything else is refused with the reason."
        confirmLabel="Delete order"
      />
    </PageBody>
  )
}
