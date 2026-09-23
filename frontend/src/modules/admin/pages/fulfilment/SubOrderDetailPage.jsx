import { useNavigate, useParams } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SubOrderCard } from '../../components/orders/SubOrderCard'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useOrderDetailController } from '../../controllers/useOrderController'

// A single sub-order, opened straight from the ops queue rather than through
// its parent. It reuses the same card the order detail screen renders, so the
// two views can never drift apart.
export function SubOrderDetailPage() {
  const navigate = useNavigate()
  const { subOrderId } = useParams()
  const parentId = subOrderId?.slice(0, 8)
  const { order, isLoading, error, refetch } = useOrderDetailController(parentId)

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const subOrder = order.subOrders.find((row) => row.id === subOrderId) || order.subOrders[0]
  const siblings = order.subOrders.length - 1

  return (
    <PageBody>
      <PageHeader
        title={subOrder.id}
        trail={[{ label: subOrder.id }]}
        description={`Part of order ${order.id} · ${subOrder.seller.name}`}
        actions={
          <>
            <Button
              variant="secondary"
              size="control"
              icon="invoices"
              onClick={() => navigate(adminPath.invoiceDetail('inv-1'))}
            >
              Invoice
            </Button>
            <Button
              variant="secondary"
              size="control"
              icon="print"
              onClick={() => navigate(adminPath.invoiceDetail('inv-1'))}
            >
              Packing slip
            </Button>
            <PermissionGate permission={ADMIN_PERMISSIONS.ORDERS_CANCEL}>
              <Button variant="dangerOutline" size="control">
                Cancel this sub-order
              </Button>
            </PermissionGate>
          </>
        }
      />

      {siblings > 0 && (
        <InlineAlert tone="info" title={`This order has ${siblings} other sub-order${siblings === 1 ? '' : 's'}`}>
          Acting on this one — cancelling, refunding, reversing its settlement — leaves the others
          exactly as they are. They share only the payment.
        </InlineAlert>
      )}

      <SubOrderCard subOrder={subOrder} />
    </PageBody>
  )
}
