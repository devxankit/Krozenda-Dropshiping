import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton } from '../../components/feedback'
import { DateCell, SectionCard, Timeline } from '../../components/display'
import { OrderItemsCard } from '../../components/orders/OrderItemsCard'
import { OrderSummaryRail } from '../../components/orders/OrderSummaryRail'
import { ORDER_FLOW_STATUS_LABELS, ORDER_FLOW_STATUS_TONE } from '../../constants'
import {
  useOrderDeleteController,
  useOrderDetailController,
  useOrderStatusController,
} from '../../controllers/useOrderController'

// Reference implementation for every detail screen: header with the primary
// actions, a stack of section cards, and a right rail for money and metadata.
export function OrderDetailPage() {
  const { orderId } = useParams()
  const { order, isLoading, error, refetch } = useOrderDetailController(orderId)
  const statusMutation = useOrderStatusController()
  const navigate = useNavigate()
  const isSuperAdmin = useAuthStore((state) => state.roles.includes('admin'))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deletion = useOrderDeleteController({ onDone: () => navigate(ADMIN_ROUTES.ORDERS, { replace: true }) })

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
      <PageHeader
        title={`Order ${shortId}`}
        trail={[{ label: shortId }]}
        actions={
          // Only a cancelled order can be removed (test data); the server
          // also refuses one money moved for, and says why.
          isSuperAdmin && order.status === 'CANCELLED' ? (
            <Button variant="dangerOutline" size="control" icon="delete" onClick={() => setConfirmDelete(true)}>
              Delete order
            </Button>
          ) : null
        }
      >
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
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deletion.run({ id: order.id })}
        isSubmitting={deletion.isSubmitting}
        title={`Delete order ${shortId}?`}
        description="The order, its parcels, return requests and notifications are removed for good. Only cancelled orders that were never paid can be deleted."
        confirmLabel="Delete order"
        confirmPhrase={shortId}
      />
    </PageBody>
  )
}
