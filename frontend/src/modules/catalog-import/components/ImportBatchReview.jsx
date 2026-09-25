import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Icon, Modal, Pagination, Skeleton, Tabs } from '../../../components/ui'
import { InlineAlert } from '../../admin/components/feedback'
import { toast } from '../../admin/stores/toastStore'
import { useImportActions, useImportBatch, useImportRows } from '../controllers/useProductImportController'
import { ImportRowCard } from './ImportRowCard'
import { ImportStatusBadge } from './ImportStatusBadge'

// Preview -> review -> decision for one import batch. Until "Approve" is
// pressed every product shown here exists only in the staging area.

const PAGE_SIZE = 20

function Stat({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'border-border bg-surface text-slate-900',
    success: 'border-success-200 bg-success-50 text-success-700',
    danger: 'border-danger-200 bg-danger-50 text-danger-700',
    warning: 'border-warning-200 bg-warning-50 text-warning-700',
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
  }
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <p className="text-2xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="tabular mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

export function ImportBatchReview({ base, batchId, onBack, productQueryKeys, productsPath, approvalNote }) {
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const batchQuery = useImportBatch(base, batchId)
  const batch = batchQuery.data
  const isProcessing = batch?.status === 'PROCESSING'
  const rowsQuery = useImportRows(base, batchId, { page, filter, enabled: Boolean(batch) && !isProcessing })
  const actions = useImportActions(base, { productQueryKeys })

  if (batchQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }
  if (batchQuery.error || !batch) {
    return (
      <EmptyState
        icon="warning"
        title="This import could not be loaded"
        description={batchQuery.error?.message}
        action={<Button variant="secondary" onClick={onBack}>Back to imports</Button>}
      />
    )
  }

  const c = batch.counts
  const isPending = batch.status === 'PENDING_REVIEW'
  const isDecided = ['APPROVED', 'REJECTED', 'FAILED'].includes(batch.status) && batch.reviewedAt
  const selectedCount = Math.max(0, c.valid - (c.excluded || 0))
  const progressPct = batch.progress.total ? Math.round((batch.progress.processed / batch.progress.total) * 100) : 0

  const tabs = isDecided && batch.status !== 'REJECTED'
    ? [
        { id: '', label: 'All', count: c.products },
        { id: 'created', label: 'Created', count: c.created },
        { id: 'updated', label: 'Updated', count: c.updated },
        { id: 'skipped', label: 'Skipped', count: c.skipped },
        { id: 'failed', label: 'Failed', count: c.failed },
        { id: 'invalid', label: 'Had errors', count: c.invalid },
      ]
    : [
        { id: '', label: 'All', count: c.products },
        { id: 'valid', label: 'Ready', count: c.valid },
        { id: 'invalid', label: 'Errors', count: c.invalid },
        { id: 'excluded', label: 'Excluded', count: c.excluded || 0 },
      ]

  async function toggleRow(row) {
    try {
      await actions.setExcluded.mutateAsync({ id: batchId, rowIds: [row.id], excluded: !row.excluded })
    } catch (err) {
      toast.error('Could not update the selection', err.message)
    }
  }

  async function setAll(excluded) {
    try {
      await actions.setExcluded.mutateAsync({ id: batchId, all: true, excluded })
    } catch (err) {
      toast.error('Could not update the selection', err.message)
    }
  }

  async function approve() {
    try {
      const res = await actions.approve.mutateAsync(batchId)
      if (res.success) toast.success('Import approved', res.message)
      else toast.error('Nothing was imported', res.message)
      setConfirmApprove(false)
      setFilter('')
      setPage(1)
    } catch (err) {
      toast.error('Approval failed', err.message)
      setConfirmApprove(false)
    }
  }

  async function reject() {
    try {
      await actions.reject.mutateAsync({ id: batchId, reason })
      toast.success('Import rejected', 'Nothing was added to the catalog.')
      setRejectOpen(false)
    } catch (err) {
      toast.error('Could not reject the import', err.message)
    }
  }

  const rows = rowsQuery.data?.items || []
  const pagination = rowsQuery.data?.pagination

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-subtle hover:text-brand-700"
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> All imports
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-900">{batch.fileName}</h2>
            <ImportStatusBadge status={batch.status} />
          </div>
          <p className="mt-0.5 text-2xs text-ink-subtle">
            Uploaded {new Date(batch.createdAt).toLocaleString('en-IN')}
            {batch.createdByName && ` by ${batch.createdByName}`}
            {' · '}
            {batch.duplicateMode === 'UPDATE' ? 'Existing SKUs are updated' : 'Existing SKUs are skipped'}
          </p>
        </div>
      </div>

      {isProcessing && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-slate-900">Checking rows and fetching images…</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {batch.progress.total
              ? `${batch.progress.processed} of ${batch.progress.total} products processed`
              : 'Reading the file'}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {batch.status === 'APPROVING' && (
        <InlineAlert tone="info" title="Importing into the catalog…">This page updates when it finishes.</InlineAlert>
      )}
      {batch.status === 'FAILED' && batch.errorMessage && (
        <InlineAlert tone="danger" title="Import failed">{batch.errorMessage}</InlineAlert>
      )}
      {batch.status === 'REJECTED' && (
        <InlineAlert tone="info" title="Rejected — nothing was added to the catalog">
          {batch.rejectionReason || 'No reason was given.'}
        </InlineAlert>
      )}
      {batch.status === 'APPROVED' && (
        <InlineAlert
          tone="success"
          title="Imported into the catalog"
          action={productsPath ? <Link to={productsPath} className="text-xs font-semibold text-brand-700">View products</Link> : null}
        >
          {c.created} created, {c.updated} updated{c.skipped ? `, ${c.skipped} skipped` : ''}
          {c.failed ? `, ${c.failed} failed` : ''}.{approvalNote ? ` ${approvalNote}` : ''}
        </InlineAlert>
      )}
      {isPending && (
        <InlineAlert tone="info" title="Nothing has been added to the catalog yet">
          Review every product below. Untick anything you do not want, then approve. Rows with errors are never
          imported — fix them in the file and upload it again.
        </InlineAlert>
      )}

      {!isProcessing && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Products in file" value={c.products} />
            {isDecided && batch.status !== 'REJECTED' ? (
              <>
                <Stat label="Created" value={c.created} tone="success" />
                <Stat label="Updated" value={c.updated} tone="brand" />
                <Stat label="Failed / errors" value={c.failed + c.invalid} tone={c.failed + c.invalid ? 'danger' : 'neutral'} />
              </>
            ) : (
              <>
                <Stat label="Ready" value={c.valid} tone="success" />
                <Stat label="With errors" value={c.invalid} tone={c.invalid ? 'danger' : 'neutral'} />
                <Stat label="Selected to import" value={selectedCount} tone="brand" />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <Tabs
              items={tabs}
              activeId={filter}
              onChange={(id) => {
                setFilter(id)
                setPage(1)
              }}
              className="min-w-0 flex-1 overflow-x-auto"
            />
            {isPending && c.valid > 0 && (
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" onClick={() => setAll(false)} disabled={actions.setExcluded.isPending}>
                  Include all
                </Button>
                <Button size="xs" variant="secondary" onClick={() => setAll(true)} disabled={actions.setExcluded.isPending}>
                  Exclude all
                </Button>
              </div>
            )}
          </div>

          {rowsQuery.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : rows.length === 0 ? (
            <EmptyState icon="list" title="No products in this view" />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <ImportRowCard
                  key={row.id}
                  row={row}
                  canReview={isPending}
                  onToggle={toggleRow}
                  isToggling={actions.setExcluded.isPending}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              totalItems={pagination.total}
              rowsPerPage={PAGE_SIZE}
              itemLabel="products"
            />
          )}
        </>
      )}

      {isPending && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
          <p className="text-xs text-ink-subtle">
            <span className="font-semibold text-slate-900">{selectedCount}</span> of {c.products} products will be imported
          </p>
          <div className="flex gap-2">
            <Button variant="dangerOutline" size="sm" onClick={() => setRejectOpen(true)}>
              Reject import
            </Button>
            <Button size="sm" icon="check" onClick={() => setConfirmApprove(true)} disabled={selectedCount === 0}>
              Approve & import {selectedCount}
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={confirmApprove}
        onClose={() => !actions.approve.isPending && setConfirmApprove(false)}
        title={`Import ${selectedCount} product${selectedCount === 1 ? '' : 's'}?`}
        description="This adds them to the catalog. It cannot be undone from here."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmApprove(false)} disabled={actions.approve.isPending}>
              Cancel
            </Button>
            <Button onClick={approve} isLoading={actions.approve.isPending} icon="check">
              Approve & import
            </Button>
          </>
        }
      >
        <ul className="space-y-1.5 text-xs text-ink-muted">
          <li>New SKUs are created as new products.</li>
          <li>
            {batch.duplicateMode === 'UPDATE'
              ? 'SKUs that already exist are updated with the filled cells only.'
              : 'SKUs that already exist are left untouched.'}
          </li>
          {approvalNote && <li>{approvalNote}</li>}
        </ul>
      </Modal>

      <Modal
        isOpen={rejectOpen}
        onClose={() => !actions.reject.isPending && setRejectOpen(false)}
        title="Reject this import?"
        description="The staged products and their images are discarded. Nothing is added to the catalog."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)} disabled={actions.reject.isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} isLoading={actions.reject.isPending}>
              Reject import
            </Button>
          </>
        }
      >
        <label htmlFor="import-reject-reason" className="text-xs font-medium text-slate-700">
          Reason (optional)
        </label>
        <textarea
          id="import-reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1.5 w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="e.g. Prices in this file are outdated"
        />
      </Modal>
    </div>
  )
}
