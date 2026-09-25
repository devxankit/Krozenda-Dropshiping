import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, EmptyState, Icon, Modal, Pagination, RadioCards, Skeleton } from '../../../components/ui'
import { InlineAlert } from '../../admin/components/feedback'
import { toast } from '../../admin/stores/toastStore'
import { useImportActions, useImportHistory } from '../controllers/useProductImportController'
import { ImportBatchReview } from './ImportBatchReview'
import { ImportStatusBadge } from './ImportStatusBadge'

// CSV product import for both the admin and the seller panel:
//   upload -> validation -> preview -> review -> approval -> products.
// The open batch lives in the URL (?batch=<id>) so a reviewer can refresh or
// share the link without losing their place.

const HISTORY_PAGE_SIZE = 10

const DUPLICATE_OPTIONS = [
  {
    value: 'SKIP',
    label: 'Skip existing SKUs',
    description: 'Rows whose SKU is already in your catalog are left out. Safest for adding new products.',
  },
  {
    value: 'UPDATE',
    label: 'Update existing SKUs',
    description: 'Matching products are updated with the filled cells only; blank cells keep their current value.',
  },
]

const STEPS = [
  { icon: 'upload', title: 'Upload CSV', text: 'Product details plus public image URLs' },
  { icon: 'check', title: 'Validation', text: 'Every row checked, images fetched' },
  { icon: 'eye', title: 'Preview & review', text: 'See each product, untick what you do not want' },
  { icon: 'approvals', title: 'Approve', text: 'Only now do products enter the catalog' },
]

function UploadModal({ isOpen, onClose, actions, onUploaded, maxRowsNote }) {
  const [file, setFile] = useState(null)
  const [duplicateMode, setDuplicateMode] = useState('SKIP')
  const [error, setError] = useState(null)

  function close() {
    setFile(null)
    setError(null)
    setDuplicateMode('SKIP')
    onClose()
  }

  async function submit() {
    if (!file) return
    setError(null)
    try {
      const res = await actions.upload.mutateAsync({ file, duplicateMode })
      toast.success('File received', 'Checking rows and fetching images.')
      onUploaded(res.data.id)
      close()
    } catch (err) {
      setError(err.message || 'That file could not be uploaded')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !actions.upload.isPending && close()}
      title="Import products from CSV"
      description="Products are staged for your review first — nothing goes live until you approve."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={actions.upload.isPending}>
            Cancel
          </Button>
          <Button icon="upload" onClick={submit} disabled={!file} isLoading={actions.upload.isPending}>
            Upload & validate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-subtle p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900">Start from the template</p>
            <p className="mt-0.5 text-2xs text-ink-subtle">
              Exact column names with a worked example. Category and brand are matched by name. Put image URLs in the
              <code className="mx-1 rounded bg-surface-sunken px-1">images</code>column separated by
              <code className="mx-1 rounded bg-surface-sunken px-1">|</code>. For variants, repeat the SKU on extra
              lines and fill the <code className="mx-1 rounded bg-surface-sunken px-1">variant…</code> columns.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={() => actions.downloadTemplate().catch(() => toast.error('Could not download the template'))}
          >
            Template
          </Button>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface p-6 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
          <Icon name="upload" className="h-5 w-5 text-brand-600" />
          <span className="text-sm font-medium text-slate-900">{file ? file.name : 'Choose a CSV file'}</span>
          <span className="text-2xs text-ink-subtle">{maxRowsNote}</span>
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

        <RadioCards
          name="duplicate-mode"
          label="When a SKU already exists"
          value={duplicateMode}
          options={DUPLICATE_OPTIONS}
          onChange={setDuplicateMode}
          columns={2}
        />

        {error && (
          <InlineAlert tone="danger" title="That file was rejected">
            {error}
          </InlineAlert>
        )}
      </div>
    </Modal>
  )
}

function HistoryList({ base, onOpen }) {
  const [page, setPage] = useState(1)
  const history = useImportHistory(base, page)

  if (history.isLoading) return <Skeleton className="h-48 w-full rounded-xl" />
  if (history.error) {
    return <EmptyState icon="warning" title="Import history could not be loaded" description={history.error.message} />
  }

  const items = history.data?.items || []
  const pagination = history.data?.pagination
  if (items.length === 0) {
    return (
      <EmptyState
        icon="upload"
        title="No imports yet"
        description="Upload a CSV to add many products at once. You will review them before they go live."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-subtle text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            <tr>
              <th scope="col" className="px-4 py-2.5">File</th>
              <th scope="col" className="px-4 py-2.5">Uploaded</th>
              <th scope="col" className="px-4 py-2.5">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right">Products</th>
              <th scope="col" className="px-4 py-2.5 text-right">Ready / errors</th>
              <th scope="col" className="px-4 py-2.5 text-right">Created / updated</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr
                key={b.id}
                onClick={() => onOpen(b.id)}
                className="cursor-pointer border-t border-border transition-colors hover:bg-surface-muted"
              >
                <td className="max-w-[16rem] truncate px-4 py-3 font-medium text-slate-900">{b.fileName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-muted">
                  {new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {b.createdByName && <span className="block text-2xs text-ink-faint">{b.createdByName}</span>}
                </td>
                <td className="px-4 py-3"><ImportStatusBadge status={b.status} /></td>
                <td className="tabular px-4 py-3 text-right">{b.counts.products || '—'}</td>
                <td className="tabular px-4 py-3 text-right">
                  {b.status === 'PROCESSING' ? '…' : (
                    <>
                      <span className="text-success-700">{b.counts.valid}</span>
                      {' / '}
                      <span className={b.counts.invalid ? 'text-danger-700' : ''}>{b.counts.invalid}</span>
                    </>
                  )}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {b.status === 'APPROVED' ? `${b.counts.created} / ${b.counts.updated}` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Icon name="chevronRight" className="ml-auto h-4 w-4 text-ink-faint" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          className="border-t border-border px-4 py-2.5"
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          totalItems={pagination.total}
          rowsPerPage={HISTORY_PAGE_SIZE}
          itemLabel="imports"
        />
      )}
    </div>
  )
}

// base            IMPORT_BASE.ADMIN or IMPORT_BASE.VENDOR
// productsPath    where "View products" links after approval
// productQueryKeys product-list caches to refresh after approval
// approvalNote    what happens to approved products next (seller: admin queue)
export function ProductImportWorkspace({ base, productsPath, productQueryKeys = [], approvalNote }) {
  const [params, setParams] = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(false)
  const actions = useImportActions(base, { productQueryKeys })
  const batchId = params.get('batch')

  const openBatch = (id) => setParams(id ? { batch: id } : {})

  if (batchId) {
    return (
      <ImportBatchReview
        base={base}
        batchId={batchId}
        onBack={() => openBatch(null)}
        productQueryKeys={productQueryKeys}
        productsPath={productsPath}
        approvalNote={approvalNote}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="control"
          icon="download"
          onClick={() => actions.downloadTemplate().catch(() => toast.error('Could not download the template'))}
        >
          Download template
        </Button>
        <Button size="control" icon="upload" onClick={() => setUploadOpen(true)}>
          Import products (CSV)
        </Button>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icon name={step.icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900">
                {i + 1}. {step.title}
              </p>
              <p className="mt-0.5 text-2xs text-ink-subtle">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Import history</h2>
        <HistoryList base={base} onOpen={openBatch} />
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        actions={actions}
        onUploaded={openBatch}
        maxRowsNote="Up to 500 lines per file · Excel users: File → Save As → CSV"
      />
    </div>
  )
}
