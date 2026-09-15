import { useParams } from 'react-router-dom'
import { Badge } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { DateCell, SectionCard, Timeline } from '../../components/display'
import { OrderItemsCard } from '../../components/orders/OrderItemsCard'
import { OrderSummaryRail } from '../../components/orders/OrderSummaryRail'
import { ORDER_FLOW_STATUS_LABELS, ORDER_FLOW_STATUS_TONE } from '../../constants'
import { useOrderDetailController, useOrderStatusController } from '../../controllers/useOrderController'

// Reference implementation for every detail screen: header with the primary
// actions, a stack of section cards, and a right rail for money and metadata.
export function OrderDetailPage() {
  const { orderId } = useParams()
  const { order, isLoading, error, refetch } = useOrderDetailController(orderId)
  const statusMutation = useOrderStatusController()

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

  const shortId = order.id.slice(-8).toUpperCase()

  return (
    <PageBody>
      <PageHeader title={`Order ${shortId}`} trail={[{ label: shortId }]}>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={ORDER_FLOW_STATUS_TONE[order.status]} dot>
            {ORDER_FLOW_STATUS_LABELS[order.status]}
          </Badge>
          <span className="text-border-strong">·</span>
          <DateCell value={order.createdAt} />
          <span className="text-border-strong">·</span>
          <span>{order.items.length} item(s)</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <OrderItemsCard items={order.items} />

          <SectionCard title="Status history">
            <div className="p-4">
              <Timeline
                events={order.statusHistory.map((entry) => ({
                  label: ORDER_FLOW_STATUS_LABELS[entry.status] || entry.status,
                  at: new Date(entry.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
                  actor: null,
                  reason: null,
                  done: true,
                  tone: entry.status === 'CANCELLED' ? 'danger' : entry.status === 'DELIVERED' ? 'success' : undefined,
                }))}
              />
            </div>
          </SectionCard>
        </div>

        <OrderSummaryRail
          order={order}
          onStatusChange={(status) => statusMutation.run({ id: order.id, status })}
          isUpdatingStatus={statusMutation.isSubmitting}
        />
      </div>
    </PageBody>
  )
}
