import { useState } from 'react'
import { Button, Pagination, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, NoData, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { CJ_SYNC_LOG_COLUMNS } from '../../tableColumns/cjColumns'
import { useCjSyncLogsController } from '../../controllers/useCjController'

const PAGE_SIZE = 25
const STATUS_OPTIONS = [
  { value: '', label: 'All results' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED', label: 'Failed' },
]

export function CjSyncLogsPage() {
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)

  const { data, isLoading, error, refetch, runNow, isRunning } = useCjSyncLogsController({
    status: status || undefined,
    pageNum,
    pageSize: PAGE_SIZE,
  })

  const list = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <PageBody>
      <PageHeader
        title="CJ Sync Logs"
        description="History of every stock/price sync — scheduled, manual and webhook-triggered. Falls back to polling when a webhook is missed."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.CJ_SYNC}>
            <Button
              size="control"
              icon="refresh"
              isLoading={isRunning}
              onClick={() => runNow({})}
            >
              Sync all now
            </Button>
          </PermissionGate>
        }
      />

      <SectionCard
        title="Sync history"
        description={`${total} total`}
        actions={
          <Select
            id="cjSyncStatus"
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
              columns={CJ_SYNC_LOG_COLUMNS}
              data={list}
              getRowKey={(row) => row._id}
              isLoading={isLoading}
              density="compact"
              emptyState={<NoData message="No sync activity yet" />}
            />
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="log entries"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>
    </PageBody>
  )
}
