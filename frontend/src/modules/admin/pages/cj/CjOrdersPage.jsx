import { useState } from 'react'
import { Button, Pagination, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, NoData } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { CJ_ORDER_COLUMNS } from '../../tableColumns/cjColumns'
import { useCjOrdersController, useCjOrderActionsController } from '../../controllers/useCjController'

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_PAYMENT', label: 'Pending payment' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FULFILLMENT_FAILED', label: 'Fulfillment failed' },
]

export function CjOrdersPage() {
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const { data, isLoading, error, refetch } = useCjOrdersController({
    status: status || undefined,
    pageNum,
    pageSize: PAGE_SIZE,
  })
  const { refreshStatus, isRefreshing, cancelOrder, isCancelling } = useCjOrderActionsController()

  const list = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = [
    ...CJ_ORDER_COLUMNS,
    {
      key: 'actions',
      header: '',
      width: '11rem',
      render: (row) => (
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={(!row.cjOrderId && !row.krozendaSubOrderId) || isRefreshing}
            onClick={() => refreshStatus(row._id)}
          >
            Refresh
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!row.cjOrderId || row.status === 'CANCELLED' || isCancelling}
            onClick={() => cancelOrder(row._id)}
          >
            Cancel
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title="CJ Orders"
        description="CJ sub-orders created against the CJ Dropshipping account, keyed to the Krozenda order that triggered them."
        actions={
          <Button variant="secondary" size="control" icon="refresh" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Orders"
        description={`${total} total`}
        actions={
          <Select
            id="cjOrderStatus"
            size="sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPageNum(1)
            }}
            options={STATUS_OPTIONS}
          />
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <Table
              columns={columns}
              data={list}
              getRowKey={(row) => row._id}
              isLoading={isLoading}
              density="compact"
              emptyState={<NoData message="No CJ orders yet" hint="Orders appear once a CJ sub-order is created." />}
            />
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="orders"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>
    </PageBody>
  )
}
