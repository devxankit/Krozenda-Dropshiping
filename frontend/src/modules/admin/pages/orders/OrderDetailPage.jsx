import { useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import { DateCell } from '../../components/display'
import { OrderSummaryRail } from '../../components/orders/OrderSummaryRail'
import { SubOrderCard } from '../../components/orders/SubOrderCard'
import {
  ADMIN_PERMISSIONS,
  FULFILMENT_STATUS_LABELS,
  FULFILMENT_STATUS_TONE,
} from '../../constants'
import { useOrderDetailController } from '../../controllers/useOrderController'

// Reference implementation for every detail screen: header with the primary
// actions, a stack of section cards, and a right rail for money and metadata.
export function OrderDetailPage() {
  const { orderId } = useParams()
  const { order, isLoading, error, refetch } = useOrderDetailController(orderId)

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

  return (
    <PageBody>
      <PageHeader
        title={order.id}
        trail={[{ label: order.id }]}
        actions={
          <>
            <Button variant="secondary" size="control" icon="invoices">
              Invoices
            </Button>
            <Button variant="secondary" size="control" icon="print">
              Packing slips
            </Button>
            <PermissionGate permission={ADMIN_PERMISSIONS.ORDERS_CANCEL}>
              <Button variant="dangerOutline" size="control">
                Cancel a sub-order
              </Button>
            </PermissionGate>
          </>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={FULFILMENT_STATUS_TONE[order.fulfilmentStatus]} dot>
            {FULFILMENT_STATUS_LABELS[order.fulfilmentStatus]}
          </Badge>
          <span className="text-border-strong">·</span>
          <DateCell value={order.placedAt} />
          <span className="text-border-strong">·</span>
          <span>
            {order.subOrders.length} sub-orders across {order.subOrders.length} vendors
          </span>
        </div>
      </PageHeader>

      <InlineAlert tone="info" title="One payment, independent fulfilment">
        Each sub-order below carries its own status, shipment, invoice, commission snapshot and
        settlement. Cancelling or refunding one leaves the others untouched.
      </InlineAlert>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {order.subOrders.map((subOrder) => (
            <SubOrderCard key={subOrder.id} subOrder={subOrder} />
          ))}
        </div>

        <OrderSummaryRail order={order} />
      </div>
    </PageBody>
  )
}
