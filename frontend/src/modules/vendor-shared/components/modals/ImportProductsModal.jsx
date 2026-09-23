import { useState } from 'react'
import { Badge, Button, Icon, Modal } from '../../../../components/ui'
import { InlineAlert } from '../../../admin/components/feedback'
import { toast } from '../../../admin/stores/toastStore'
import { api } from '../../../../lib/axios'

// Bulk upload, in two deliberate steps: VALIDATE, then IMPORT.
//
// The first press is always a dry run. A seller uploading 300 rows should find
// out that 40 of them name a category that does not exist BEFORE 260 products
// appear in their catalog and they have to work out which ones are missing.
// The server does the same split (see vendorProductImportController) — this
// screen just never skips the preview.
const STEP = { PICK: 'pick', PREVIEW: 'preview', DONE: 'done' }

function ErrorTable({ failures }) {
  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-border admin-scroll">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface-subtle">
          <tr className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            <th scope="col" className="px-3 py-2">Row</th>
            <th scope="col" className="px-3 py-2">Product</th>
            <th scope="col" className="px-3 py-2">Problem</th>
          </tr>
        </thead>
        <tbody>
          {failures.map((failure) => (
            <tr key={`${failure.line}-${failure.error}`} className="border-t border-border">
              {/* The line number matches the row gutter in their spreadsheet,
                  which is the only address a seller can actually navigate to. */}
              <td className="px-3 py-2 font-mono text-2xs text-ink-muted">{failure.line}</td>
              <td className="px-3 py-2 text-slate-900">{failure.name || '—'}</td>
              <td className="px-3 py-2 text-danger-700">{failure.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ImportProductsModal({ isOpen, onClose, onImported }) {
  const [step, setStep] = useState(STEP.PICK)
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [isBusy, setIsBusy] = useState(false)

  function reset() {
    setStep(STEP.PICK)
    setFile(null)
    setReport(null)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function send({ dryRun }) {
    if (!file) return
    setIsBusy(true)
    setError(null)

    const body = new FormData()
    body.append('file', file)
    if (dryRun) body.append('dryRun', 'true')

    try {
      const { data } = await api.post('/vendor/products/import', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReport(data.data)
      setStep(dryRun ? STEP.PREVIEW : STEP.DONE)
      if (!dryRun) {
        toast.success('Import finished', data.message)
        onImported?.()
      }
    } catch (err) {
      // A whole-file rejection (missing column, too many rows, not a CSV) comes
      // back as a message rather than a per-row report — there are no rows to
      // report on.
      const errMsg = err?.response?.data?.message || 'That file could not be imported'
      setError(errMsg)
      toast.error('Import failed', errMsg)
    } finally {
      setIsBusy(false)
    }
  }

  async function downloadTemplate() {
    try {
      const response = await api.get('/vendor/products/import/template', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'krozenda-product-import-template.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not download the template', 'Try again in a moment.')
    }
  }

  const readyCount = report?.readyCount ?? 0
  const failures = report?.failed ?? []

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import products from a spreadsheet"
      description="Upload a CSV. Every row is checked before anything is saved."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {step === STEP.DONE ? 'Close' : 'Cancel'}
          </Button>

          {step === STEP.PICK && (
            <Button onClick={() => send({ dryRun: true })} disabled={!file || isBusy} icon="upload">
              {isBusy ? 'Checking…' : 'Check file'}
            </Button>
          )}

          {step === STEP.PREVIEW && (
            <Button onClick={() => send({ dryRun: false })} disabled={readyCount === 0 || isBusy} icon="add">
              {isBusy ? 'Importing…' : `Import ${readyCount} product${readyCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {step === STEP.PICK && (
          <>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-subtle p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">Start from the template</p>
                <p className="mt-0.5 text-2xs text-ink-subtle">
                  It has the exact column names and one worked example. Category and brand are matched by name, so
                  they must already exist in your panel.
                </p>
              </div>
              <Button size="sm" variant="secondary" icon="download" onClick={downloadTemplate}>
                Template
              </Button>
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-5 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
              <Icon name="upload" className="h-4 w-4 text-brand-600" />
              <span className="text-xs font-medium text-slate-900">
                {file ? file.name : 'Choose a CSV file'}
              </span>
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
              Excel files are not read directly — in Excel, choose <strong>Save As</strong> and pick CSV. Up to 500
              rows per upload.
            </p>
          </>
        )}

        {step === STEP.PREVIEW && report && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={readyCount > 0 ? 'success' : 'neutral'} size="md">
                {readyCount} ready
              </Badge>
              {failures.length > 0 && (
                <Badge tone="danger" size="md">
                  {failures.length} with problems
                </Badge>
              )}
              <span className="text-2xs text-ink-subtle">of {report.totalRows} rows</span>
            </div>

            {readyCount > 0 && (
              <InlineAlert tone={report.willAutoApprove ? 'success' : 'info'} title="Nothing has been saved yet">
                {report.willAutoApprove
                  ? `Importing will add ${readyCount} product${readyCount === 1 ? '' : 's'} and put them live.`
                  : `Importing will add ${readyCount} product${readyCount === 1 ? '' : 's'} for admin approval.`}
                {failures.length > 0 && ' The rows below are skipped.'}
              </InlineAlert>
            )}

            {readyCount === 0 && (
              <InlineAlert tone="danger" title="No row can be imported">
                Fix the problems below and upload the file again.
              </InlineAlert>
            )}

            {failures.length > 0 && <ErrorTable failures={failures} />}
          </>
        )}

        {step === STEP.DONE && report && (
          <>
            <InlineAlert tone={report.created > 0 ? 'success' : 'danger'} title={`${report.created} imported`}>
              {report.created > 0
                ? report.willAutoApprove
                  ? 'They are live in the catalog now.'
                  : 'They are queued for admin approval.'
                : 'Nothing was saved.'}
            </InlineAlert>

            {failures.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-900">{failures.length} row(s) were skipped</p>
                <ErrorTable failures={failures} />
              </>
            )}
          </>
        )}

        {error && (
          <InlineAlert tone="danger" title="That file was rejected">
            {error}
          </InlineAlert>
        )}
      </div>
    </Modal>
  )
}
