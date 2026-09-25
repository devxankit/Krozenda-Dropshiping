import { useEffect, useRef, useState } from 'react'
import { Button, EmptyState, Icon, Modal, Pagination, Skeleton, Tabs } from '../../../components/ui'
import { InlineAlert } from '../../admin/components/feedback'
import { toast } from '../../admin/stores/toastStore'
import {
  useImportActions,
  useImportBatch,
  useImportHistory,
  useImportRows,
} from '../controllers/useProductImportController'
import { IMPORT_BASE } from '../services/productImportService'
import { ImportStatusBadge } from './ImportStatusBadge'

// CSV import, opened from the Products page itself — the admin panel's and
// the seller panel's, which run the same PREVIEW flow against different base
// paths. Valid rows land in the product list straight away as Draft "Preview"
// products (hidden from buyers); this modal only uploads, shows progress, and
// reports the rows that could not be added. Approving happens in the list.
//
// `approveNote` says what approving does for this panel: admin approval puts
// a product live, a seller's submits it for platform review.

const DEFAULT_APPROVE_NOTE = 'Check each one (view, edit or delete), then press Approve to make it live.'

function ProblemRows({ base, batchId }) {
  const invalid = useImportRows(base, batchId, { page: 1, filter: 'invalid', enabled: true })
  const failed = useImportRows(base, batchId, { page: 1, filter: 'failed', enabled: true })
  const rows = [...(invalid.data?.items || []), ...(failed.data?.items || [])].sort((a, b) => a.index - b.index)
  const total = (invalid.data?.pagination?.total || 0) + (failed.data?.pagination?.total || 0)

  if (invalid.isLoading || failed.isLoading) return <Skeleton className="h-24 w-full rounded-lg" />
  if (rows.length === 0) return null

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-900">
        {total} row{total === 1 ? '' : 's'} not added — fix them in the file and upload again
      </p>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border admin-scroll">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-subtle text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" className="px-3 py-2">Line</th>
              <th scope="col" className="px-3 py-2">Product</th>
              <th scope="col" className="px-3 py-2">Problem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-mono text-2xs text-ink-muted">{row.lines.join(', ')}</td>
                <td className="px-3 py-2 text-slate-900">
                  {row.product.name || '—'}
                  {row.product.sku && <span className="block font-mono text-2xs text-ink-faint">{row.product.sku}</span>}
                </td>
                <td className="px-3 py-2 text-danger-700">
                  {(row.errors.length ? row.errors : [row.resultMessage]).map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="mt-1 text-2xs text-ink-subtle">Showing the first {rows.length}.</p>
      )}
    </div>
  )
}

function BatchResult({ base, batchId, approveNote, onShowPreviews, onFinished }) {
  const { data: batch, isLoading } = useImportBatch(base, batchId)
  const wasProcessing = useRef(false)

  // The products appear in the list the moment processing ends.
  useEffect(() => {
    if (!batch) return
    if (batch.status === 'PROCESSING') wasProcessing.current = true
    else if (wasProcessing.current) {
      wasProcessing.current = false
      onFinished?.(batch)
    }
  }, [batch, onFinished])

  if (isLoading || !batch) return <Skeleton className="h-32 w-full rounded-lg" />

  const c = batch.counts
  if (batch.status === 'PROCESSING') {
    const pct = batch.progress.total ? Math.round((batch.progress.processed / batch.progress.total) * 100) : 0
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-slate-900">Checking rows and fetching images…</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {batch.progress.total ? `${batch.progress.processed} of ${batch.progress.total} products` : 'Reading the file'}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const waiting = Math.max(0, c.created - c.approved)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
        <span className="font-semibold text-slate-900">{batch.fileName}</span>
        <ImportStatusBadge status={batch.status} />
        <span>{new Date(batch.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>

      {c.created > 0 ? (
        <InlineAlert
          tone="success"
          title={`${c.created} product${c.created === 1 ? '' : 's'} added to the product list as Preview`}
          action={
            waiting > 0 ? (
              <Button size="xs" onClick={onShowPreviews}>
                Review previews
              </Button>
            ) : null
          }
        >
          They are Drafts and hidden from buyers. {approveNote}
          {c.approved > 0 && ` ${c.approved} already approved.`}
        </InlineAlert>
      ) : (
        batch.errorMessage && (
          <InlineAlert tone="danger" title="Nothing was added">
            {batch.errorMessage}
          </InlineAlert>
        )
      )}

      {c.skipped > 0 && (
        <p className="text-xs text-ink-subtle">
          {c.skipped} row{c.skipped === 1 ? '' : 's'} skipped — the SKU already exists in the catalog. Edit those
          products directly.
        </p>
      )}

      <ProblemRows base={base} batchId={batchId} />
    </div>
  )
}

function History({ base, onOpen }) {
  const [page, setPage] = useState(1)
  const history = useImportHistory(base, page)
  if (history.isLoading) return <Skeleton className="h-40 w-full rounded-lg" />
  const items = history.data?.items || []
  if (!items.length) return <EmptyState icon="upload" title="No imports yet" />
  const pagination = history.data?.pagination

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" className="px-3 py-2">File</th>
              <th scope="col" className="px-3 py-2">Uploaded</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2 text-right">Added</th>
              <th scope="col" className="px-3 py-2 text-right">Approved</th>
              <th scope="col" className="px-3 py-2 text-right">Errors</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr
                key={b.id}
                onClick={() => onOpen(b.id)}
                className="cursor-pointer border-t border-border hover:bg-surface-muted"
              >
                <td className="max-w-[12rem] truncate px-3 py-2 font-medium text-slate-900">{b.fileName}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                  {new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {b.createdByName && <span className="block text-2xs text-ink-faint">{b.createdByName}</span>}
                </td>
                <td className="px-3 py-2"><ImportStatusBadge status={b.status} /></td>
                <td className="tabular px-3 py-2 text-right">{b.counts.created}</td>
                <td className="tabular px-3 py-2 text-right">{b.counts.approved}</td>
                <td className={`tabular px-3 py-2 text-right ${b.counts.invalid + b.counts.failed ? 'text-danger-700' : ''}`}>
                  {b.counts.invalid + b.counts.failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} totalItems={pagination.total} rowsPerPage={10} itemLabel="imports" />
      )}
    </div>
  )
}

// onShowPreviews: close the modal and filter the product list to previews.
// onFinished: an upload has finished processing (refresh the product list).
export function AdminImportModal({
  isOpen,
  onClose,
  onShowPreviews,
  onFinished,
  base = IMPORT_BASE.ADMIN,
  approveNote = DEFAULT_APPROVE_NOTE,
}) {
  const [tab, setTab] = useState('upload')
  const [file, setFile] = useState(null)
  const [batchId, setBatchId] = useState(null)
  const [error, setError] = useState(null)
  const actions = useImportActions(base)

  function reset() {
    setFile(null)
    setBatchId(null)
    setError(null)
    setTab('upload')
  }

  function close() {
    reset()
    onClose()
  }

  async function submit() {
    if (!file) return
    setError(null)
    try {
      const res = await actions.upload.mutateAsync({ file, duplicateMode: 'SKIP' })
      setBatchId(res.data.id)
    } catch (err) {
      setError(err.message || 'That file could not be uploaded')
    }
  }

  function download() {
    actions.downloadTemplate().catch(() => toast.error('Could not download the template'))
  }

  const showingResult = Boolean(batchId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !actions.upload.isPending && close()}
      title="Import products (CSV)"
      description="Imported products appear in the list as Preview drafts. Nothing goes further until you approve it."
      size="lg"
      footer={
        showingResult ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
            <Button onClick={() => { close(); onShowPreviews?.() }}>Done</Button>
          </>
        ) : tab === 'upload' ? (
          <>
            <Button variant="secondary" onClick={close} disabled={actions.upload.isPending}>
              Cancel
            </Button>
            <Button icon="upload" onClick={submit} disabled={!file} isLoading={actions.upload.isPending}>
              Upload & import
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        )
      }
    >
      {!showingResult && (
        <Tabs
          className="mb-4"
          activeId={tab}
          onChange={setTab}
          items={[
            { id: 'upload', label: 'Upload' },
            { id: 'history', label: 'Import history' },
          ]}
        />
      )}

      {showingResult ? (
        <BatchResult
          base={base}
          batchId={batchId}
          approveNote={approveNote}
          onFinished={onFinished}
          onShowPreviews={() => {
            close()
            onShowPreviews?.()
          }}
        />
      ) : tab === 'history' ? (
        <History base={base} onOpen={setBatchId} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-subtle p-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Start from the template</p>
              <p className="mt-0.5 text-2xs text-ink-subtle">
                Required: name, sku, category, price, weight and at least one image URL. Put several image URLs in the
                <code className="mx-1 rounded bg-surface-sunken px-1">images</code>column separated by
                <code className="mx-1 rounded bg-surface-sunken px-1">|</code>. For variants, repeat the SKU on extra
                lines and fill the <code className="mx-1 rounded bg-surface-sunken px-1">variant…</code> columns.
              </p>
            </div>
            <Button size="sm" variant="secondary" icon="download" onClick={download}>
              Template
            </Button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface p-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
            <Icon name="upload" className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-medium text-slate-900">{file ? file.name : 'Choose a CSV file'}</span>
            <span className="text-2xs text-ink-subtle">Up to 500 lines · Excel: File → Save As → CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setError(null)
              }}
            />
          </label>

          <p className="text-2xs text-ink-subtle">
            Rows whose SKU already exists in the catalog are skipped — edit those products directly.
          </p>

          {error && (
            <InlineAlert tone="danger" title="That file was rejected">
              {error}
            </InlineAlert>
          )}
        </div>
      )}
    </Modal>
  )
}
