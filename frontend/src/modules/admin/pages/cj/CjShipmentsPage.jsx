import { useState } from 'react'
import { Button, Pagination, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, NoData } from '../../components/feedback'
import { SectionCard, Timeline } from '../../components/display'
import { CJ_SHIPMENT_COLUMNS } from '../../tableColumns/cjColumns'
import { useCjShipmentsController, useCjShipmentActionsController } from '../../controllers/useCjController'

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'DELIVERY_FAILED', label: 'Delivery failed' },
  { value: 'RTO', label: 'RTO' },
]

export function CjShipmentsPage() {
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [expanded, setExpanded] = useState(null)

  const { data, isLoading, error, refetch } = useCjShipmentsController({
    status: status || undefined,
    pageNum,
    pageSize: PAGE_SIZE,
  })
  const { refreshTracking, isRefreshing } = useCjShipmentActionsController()

  const list = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selected = list.find((row) => row._id === expanded)

  const columns = [
    ...CJ_SHIPMENT_COLUMNS,
    {
      key: 'actions',
      header: '',
      width: '7rem',
      render: (row) => (
        <Button
          variant="secondary"
          size="sm"
          disabled={isRefreshing}
          onClick={(e) => {
            e.stopPropagation()
            refreshTracking(row._id)
          }}
        >
          Refresh
        </Button>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title="CJ Shipments"
        description="Tracking for CJ-fulfilled parcels — fed by CJ's webhook, with a polling fallback for anything the webhook misses."
        actions={
          <Button variant="secondary" size="control" icon="refresh" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Shipments"
        description={`${total} total`}
        actions={
          <Select
            id="cjShipmentStatus"
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
              onRowClick={(row) => setExpanded(row._id === expanded ? null : row._id)}
              emptyState={<NoData message="No shipments yet" hint="A shipment row appears once a CJ order's tracking is first synced." />}
            />
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="shipments"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>

      {selected && (
        <SectionCard title={`Tracking — ${selected.trackingNumber || selected.cjOrderId}`}>
          {selected.trackingEvents?.length ? (
            <Timeline
              events={selected.trackingEvents.map((e) => ({
                label: e.status,
                at: e.occurredAt,
                reason: e.description,
                done: true,
              }))}
            />
          ) : (
            <NoData message="No tracking events yet" />
          )}
        </SectionCard>
      )}
    </PageBody>
  )
}
