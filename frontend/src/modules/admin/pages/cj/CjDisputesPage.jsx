import { useState } from 'react'
import { Button, Input, Modal, Pagination, Select, Table, Textarea } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, NoData, PermissionGate } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { ADMIN_PERMISSIONS } from '../../constants'
import { CJ_DISPUTE_COLUMNS } from '../../tableColumns/cjColumns'
import { useCjDisputesController } from '../../controllers/useCjController'

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'CREATED', label: 'Created' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function NewDisputeModal({ isOpen, onClose, createDispute, isCreating, createError }) {
  const [form, setForm] = useState({ cjOrderId: '', reason: '', description: '', requestedRecoveryAmount: '' })

  if (!isOpen) return null

  async function handleSubmit() {
    await createDispute({ ...form, requestedRecoveryAmount: Number(form.requestedRecoveryAmount) || 0 })
    onClose()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Open a CJ dispute"
      description="Recovers cost/shipping FROM CJ — this is separate from the customer's own Razorpay refund."
      footer={
        <>
          <Button variant="secondary" size="control" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="control"
            isLoading={isCreating}
            disabled={!form.cjOrderId || !form.reason}
            onClick={handleSubmit}
          >
            Create dispute
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {createError && (
          <InlineAlert tone="danger" title="Could not create dispute">
            {createError?.response?.data?.message || createError.message}
          </InlineAlert>
        )}
        <Input
          id="disputeCjOrderId"
          label="CJ Order ID"
          size="control"
          value={form.cjOrderId}
          onChange={(e) => setForm((f) => ({ ...f, cjOrderId: e.target.value }))}
        />
        <Input
          id="disputeReason"
          label="Reason"
          size="control"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
        />
        <Textarea
          id="disputeDescription"
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <Input
          id="disputeAmount"
          label="Requested recovery amount"
          type="number"
          size="control"
          value={form.requestedRecoveryAmount}
          onChange={(e) => setForm((f) => ({ ...f, requestedRecoveryAmount: e.target.value }))}
        />
      </div>
    </Modal>
  )
}

export function CjDisputesPage() {
  const [status, setStatus] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading, error, refetch, createDispute, isCreating, createError } = useCjDisputesController({
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
        title="CJ Returns & Disputes"
        description="Disputes opened against CJ to recover cost/shipping — kept separate from the customer's own refund."
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.CJ_RETURNS}>
            <Button size="control" icon="add" onClick={() => setModalOpen(true)}>
              New dispute
            </Button>
          </PermissionGate>
        }
      />

      <SectionCard
        title="Disputes"
        description={`${total} total`}
        actions={
          <Select
            id="cjDisputeStatus"
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
              columns={CJ_DISPUTE_COLUMNS}
              data={list}
              getRowKey={(row) => row._id}
              isLoading={isLoading}
              density="compact"
              emptyState={<NoData message="No disputes yet" />}
            />
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="disputes"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>

      <NewDisputeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        createDispute={createDispute}
        isCreating={isCreating}
        createError={createError}
      />
    </PageBody>
  )
}
