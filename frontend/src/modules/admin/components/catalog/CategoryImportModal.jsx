import { useRef, useState } from 'react'
import { Badge, Button, Modal, Table } from '../../../../components/ui'
import { InlineAlert } from '../feedback'
import { parseCsv } from '../../lib/parseCsv'

// Bulk-create categories from a CSV. The file is read here; the server checks
// every row (dry run) and the preview shows what will happen before anything
// is written. Re-running a file is safe: names that already exist are skipped.

const TEMPLATE = [
  'name,active,top_category,food,commission_type,commission_value',
  'Home Decor,yes,no,no,PERCENTAGE,10',
  'Organic Snacks,yes,yes,yes,,',
].join('\r\n')

// Header → field. Headers are matched ignoring case, spaces and underscores.
const HEADERS = {
  name: 'name',
  category: 'name',
  categoryname: 'name',
  active: 'isActive',
  isactive: 'isActive',
  topcategory: 'isTopCategory',
  istopcategory: 'isTopCategory',
  top: 'isTopCategory',
  food: 'isFood',
  isfood: 'isFood',
  commissiontype: 'commissionType',
  commissionvalue: 'commissionValue',
  commission: 'commissionValue',
}

const MAX_ROWS = 500

const OUTCOME = {
  create: { tone: 'success', label: 'Will be created' },
  skip: { tone: 'neutral', label: 'Skipped' },
  error: { tone: 'danger', label: 'Error' },
}

// CSV text → row objects for the API, or an error message for the whole file.
function readRows(text) {
  const table = parseCsv(text)
  if (table.length < 2) return { error: 'The file needs a header row and at least one category.' }
  const fields = table[0].map((h) => HEADERS[h.toLowerCase().replace(/[^a-z]/g, '')] || null)
  if (!fields.includes('name')) return { error: 'No "name" column found. Start from the template.' }
  const rows = table.slice(1).map((cells) => {
    const row = {}
    fields.forEach((field, i) => {
      if (field && cells[i] !== undefined) row[field] = cells[i].trim()
    })
    return row
  })
  if (rows.length > MAX_ROWS) return { error: `The file has ${rows.length} rows — import at most ${MAX_ROWS} at a time.` }
  return { rows }
}

function downloadTemplate() {
  // The byte-order mark makes Excel open the file as UTF-8.
  const blob = new Blob([String.fromCharCode(0xfeff) + TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'category-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

const PREVIEW_COLUMNS = [
  { key: 'row', header: 'Row', width: '4rem', render: (r) => <span className="tabular text-ink-muted">{r.row}</span> },
  { key: 'name', header: 'Category', render: (r) => r.name || <span className="text-ink-faint">(blank)</span> },
  {
    key: 'outcome',
    header: 'Result',
    width: '9rem',
    render: (r) => (
      <Badge tone={OUTCOME[r.outcome].tone} size="sm" dot>
        {OUTCOME[r.outcome].label}
      </Badge>
    ),
  },
  { key: 'reason', header: 'Note', render: (r) => <span className="text-xs text-ink-muted">{r.reason}</span> },
]

export function CategoryImportModal({ isOpen, onClose, writer }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fileError, setFileError] = useState('')

  function reset() {
    setFileName('')
    setRows(null)
    setPreview(null)
    setFileError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function close() {
    reset()
    onClose()
  }

  async function onFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setPreview(null)
    setFileName(file.name)
    const parsed = readRows(await file.text())
    if (parsed.error) {
      setRows(null)
      setFileError(parsed.error)
      return
    }
    setFileError('')
    setRows(parsed.rows)
    const result = await writer.previewImport.runAsync({ rows: parsed.rows }).catch(() => null)
    setPreview(result)
  }

  async function runImport() {
    await writer.runImport.runAsync({ rows }).catch(() => null)
    close()
  }

  const toCreate = preview?.summary.create || 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="lg"
      title="Import categories"
      description="Upload a CSV file. Nothing is saved until you confirm the preview."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="control" icon="download" onClick={downloadTemplate}>
            Download template
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="control" onClick={close}>
              Cancel
            </Button>
            <Button
              size="control"
              onClick={runImport}
              disabled={!preview || toCreate === 0}
              isLoading={writer.runImport.isSubmitting}
            >
              {toCreate > 0 ? `Import ${toCreate} ${toCreate === 1 ? 'category' : 'categories'}` : 'Import'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-xs text-ink-muted">
          <p>
            Columns: <strong>name</strong> (required), <strong>active</strong>, <strong>top_category</strong>,{' '}
            <strong>food</strong> (yes/no — blank means active: yes, others: no), and optionally{' '}
            <strong>commission_type</strong> (PERCENTAGE or FIXED) with <strong>commission_value</strong>.
            Existing names are skipped. Images are added afterwards from each category. From Excel, use
            &quot;Save as → CSV UTF-8&quot;.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2">
            <span className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 hover:bg-slate-50">
              Choose CSV file
            </span>
            <span className="text-ink-faint">{fileName || 'No file chosen'}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="CSV file"
              onChange={onFile}
            />
          </label>
        </div>

        {fileError && (
          <InlineAlert tone="danger" title="This file cannot be imported">
            {fileError}
          </InlineAlert>
        )}

        {writer.previewImport.isSubmitting && <p className="text-xs text-ink-muted">Checking {rows?.length} rows…</p>}

        {preview && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="success" size="sm">{preview.summary.create} to create</Badge>
              <Badge tone="neutral" size="sm">{preview.summary.skip} skipped</Badge>
              <Badge tone={preview.summary.error ? 'danger' : 'neutral'} size="sm">
                {preview.summary.error} with errors
              </Badge>
            </div>
            {preview.summary.error > 0 && (
              <InlineAlert tone="warning" title="Rows with errors will not be imported">
                Fix them in the file and upload it again, or import the rest now.
              </InlineAlert>
            )}
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              <Table
                className="rounded-none border-0"
                columns={PREVIEW_COLUMNS}
                data={preview.rows}
                getRowKey={(r) => r.row}
                density="compact"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
