import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Button, EmptyState, Icon, Modal, Pagination, Skeleton, Table, Tabs, Text } from '../../../components/ui'
import { InlineAlert } from '../../../components/admin/feedback'
import { toast } from '../../../lib/toast'
import { pickDocumentFile } from '../../vendor-shared/lib/filePicker'
import { colors, radius } from '../../../theme'
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

const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', 'text/plain']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// en-IN `{ dateStyle: 'medium', timeStyle: 'short' }`, e.g. "9 Oct 2026, 3:05 pm".
function formatDateTime(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${mins} ${h >= 12 ? 'pm' : 'am'}`
}

const PROBLEM_COLUMNS = [
  {
    key: 'lines',
    header: 'Line',
    width: 80,
    render: (row) => (
      <Text noTranslate style={styles.mono}>
        {row.lines.join(', ')}
      </Text>
    ),
  },
  {
    key: 'product',
    header: 'Product',
    width: 150,
    render: (row) => (
      <View>
        <Text style={styles.cellMain}>{row.product.name || '—'}</Text>
        {row.product.sku ? (
          <Text noTranslate style={[styles.mono, { color: colors.ink.faint }]}>
            {row.product.sku}
          </Text>
        ) : null}
      </View>
    ),
  },
  {
    key: 'errors',
    header: 'Problem',
    width: 200,
    render: (row) => (
      <View>
        {(row.errors.length ? row.errors : [row.resultMessage]).map((e) => (
          <Text key={e} style={{ fontSize: 12, lineHeight: 16, color: colors.danger[700] }}>
            {e}
          </Text>
        ))}
      </View>
    ),
  },
]

function ProblemRows({ base, batchId }) {
  const invalid = useImportRows(base, batchId, { page: 1, filter: 'invalid', enabled: true })
  const failed = useImportRows(base, batchId, { page: 1, filter: 'failed', enabled: true })
  const rows = [...(invalid.data?.items || []), ...(failed.data?.items || [])].sort((a, b) => a.index - b.index)
  const total = (invalid.data?.pagination?.total || 0) + (failed.data?.pagination?.total || 0)

  if (invalid.isLoading || failed.isLoading) return <Skeleton style={{ height: 96, width: '100%', borderRadius: radius.lg }} />
  if (rows.length === 0) return null

  return (
    <View>
      <Text style={styles.problemTitle}>
        {`${total} row${total === 1 ? '' : 's'} not added — fix them in the file and upload again`}
      </Text>
      <ScrollView nestedScrollEnabled style={styles.problemBox}>
        <Table columns={PROBLEM_COLUMNS} data={rows} getRowKey={(row) => row.id} density="compact" style={{ borderWidth: 0, borderRadius: 0 }} />
      </ScrollView>
      {total > rows.length ? <Text style={styles.small}>{`Showing the first ${rows.length}.`}</Text> : null}
    </View>
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

  if (isLoading || !batch) return <Skeleton style={{ height: 128, width: '100%', borderRadius: radius.lg }} />

  const c = batch.counts
  if (batch.status === 'PROCESSING') {
    const pct = batch.progress.total ? Math.round((batch.progress.processed / batch.progress.total) * 100) : 0
    return (
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Checking rows and fetching images…</Text>
        <Text style={styles.progressSub}>
          {batch.progress.total ? `${batch.progress.processed} of ${batch.progress.total} products` : 'Reading the file'}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
    )
  }

  const waiting = Math.max(0, c.created - c.approved)

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.metaRow}>
        <Text style={styles.fileName}>{batch.fileName}</Text>
        <ImportStatusBadge status={batch.status} />
        <Text noTranslate style={styles.metaText}>
          {formatDateTime(batch.createdAt)}
        </Text>
      </View>

      {c.created > 0 ? (
        <InlineAlert
          tone="success"
          title={`${c.created} product${c.created === 1 ? '' : 's'} added to the product list as Preview`}
          action={
            waiting > 0 ? (
              <Button size="xs" onPress={onShowPreviews}>
                Review previews
              </Button>
            ) : null
          }
        >
          {`They are Drafts and hidden from buyers. ${approveNote}${c.approved > 0 ? ` ${c.approved} already approved.` : ''}`}
        </InlineAlert>
      ) : batch.errorMessage ? (
        <InlineAlert tone="danger" title="Nothing was added">
          {batch.errorMessage}
        </InlineAlert>
      ) : null}

      {c.skipped > 0 ? (
        <Text style={styles.metaText}>
          {`${c.skipped} row${c.skipped === 1 ? '' : 's'} skipped — the SKU already exists in the catalog. Edit those products directly.`}
        </Text>
      ) : null}

      <ProblemRows base={base} batchId={batchId} />
    </View>
  )
}

function History({ base, onOpen }) {
  const [page, setPage] = useState(1)
  const history = useImportHistory(base, page)
  if (history.isLoading) return <Skeleton style={{ height: 160, width: '100%', borderRadius: radius.lg }} />
  const items = history.data?.items || []
  if (!items.length) return <EmptyState icon="upload" title="No imports yet" />
  const pagination = history.data?.pagination

  const columns = [
    {
      key: 'fileName',
      header: 'File',
      width: 150,
      render: (b) => (
        <Text numberOfLines={1} style={styles.cellMain}>
          {b.fileName}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      header: 'Uploaded',
      width: 140,
      render: (b) => (
        <View>
          <Text noTranslate style={styles.cellMuted}>
            {formatDateTime(b.createdAt)}
          </Text>
          {b.createdByName ? <Text style={styles.cellFaint}>{b.createdByName}</Text> : null}
        </View>
      ),
    },
    { key: 'status', header: 'Status', width: 130, render: (b) => <ImportStatusBadge status={b.status} /> },
    {
      key: 'created',
      header: 'Added',
      width: 70,
      align: 'right',
      render: (b) => (
        <Text noTranslate style={styles.num}>
          {b.counts.created}
        </Text>
      ),
    },
    {
      key: 'approved',
      header: 'Approved',
      width: 85,
      align: 'right',
      render: (b) => (
        <Text noTranslate style={styles.num}>
          {b.counts.approved}
        </Text>
      ),
    },
    {
      key: 'errors',
      header: 'Errors',
      width: 70,
      align: 'right',
      render: (b) => (
        <Text noTranslate style={[styles.num, b.counts.invalid + b.counts.failed ? { color: colors.danger[700] } : null]}>
          {b.counts.invalid + b.counts.failed}
        </Text>
      ),
    },
  ]

  return (
    <View style={{ gap: 12 }}>
      <Table columns={columns} data={items} getRowKey={(b) => b.id} density="compact" onRowClick={(b) => onOpen(b.id)} />
      {pagination && pagination.totalPages > 1 ? (
        <Pagination page={page} totalPages={pagination.totalPages} onPageChange={setPage} totalItems={pagination.total} rowsPerPage={10} itemLabel="imports" />
      ) : null}
    </View>
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

  async function chooseFile() {
    const picked = await pickDocumentFile(CSV_TYPES)
    if (!picked) return
    setFile(picked)
    setError(null)
  }

  async function submit() {
    if (!file || actions.upload.isPending) return
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
      footer={
        showingResult ? (
          <>
            <Button variant="secondary" onPress={reset}>
              Import another file
            </Button>
            <Button
              onPress={() => {
                close()
                onShowPreviews?.()
              }}
            >
              Done
            </Button>
          </>
        ) : tab === 'upload' ? (
          <>
            <Button variant="secondary" onPress={close} disabled={actions.upload.isPending}>
              Cancel
            </Button>
            <Button icon="upload" onPress={submit} disabled={!file} isLoading={actions.upload.isPending}>
              Upload & import
            </Button>
          </>
        ) : (
          <Button variant="secondary" onPress={close}>
            Close
          </Button>
        )
      }
    >
      {!showingResult ? (
        <Tabs
          style={{ marginBottom: 16 }}
          activeId={tab}
          onChange={setTab}
          items={[
            { id: 'upload', label: 'Upload' },
            { id: 'history', label: 'Import history' },
          ]}
        />
      ) : null}

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
        <View style={{ gap: 16 }}>
          <View style={styles.templateBox}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.templateTitle}>Start from the template</Text>
              <Text style={styles.templateText}>
                Required: name, sku, category, price, weight and at least one image URL. Put several image URLs in the{' '}
                <Text noTranslate style={styles.code}>
                  images
                </Text>{' '}
                column separated by{' '}
                <Text noTranslate style={styles.code}>
                  |
                </Text>
                . For variants, repeat the SKU on extra lines and fill the{' '}
                <Text noTranslate style={styles.code}>
                  variant…
                </Text>{' '}
                columns.
              </Text>
            </View>
            <Button size="sm" variant="secondary" icon="download" onPress={download}>
              Template
            </Button>
          </View>

          <Pressable onPress={chooseFile} accessibilityRole="button" style={({ pressed }) => [styles.drop, pressed && { backgroundColor: 'rgba(239,246,255,0.4)' }]}>
            <Icon name="upload" size={20} color={colors.brand[600]} />
            <Text noTranslate={Boolean(file)} style={styles.dropTitle}>
              {file ? file.name : 'Choose a CSV file'}
            </Text>
            <Text style={styles.templateText}>Up to 500 lines · Excel: File → Save As → CSV</Text>
          </Pressable>

          <Text style={styles.templateText}>
            Rows whose SKU already exists in the catalog are skipped — edit those products directly.
          </Text>

          {error ? (
            <InlineAlert tone="danger" title="That file was rejected">
              {error}
            </InlineAlert>
          ) : null}
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  mono: { fontFamily: 'monospace', fontSize: 11, lineHeight: 16, color: colors.ink.muted },
  cellMain: { fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.slate[900] },
  cellMuted: { fontSize: 12, lineHeight: 16, color: colors.ink.muted },
  cellFaint: { fontSize: 11, lineHeight: 16, color: colors.ink.faint },
  num: { fontSize: 12, color: colors.slate[800] },
  problemTitle: { marginBottom: 6, fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  problemBox: { maxHeight: 256, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT },
  small: { marginTop: 4, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  progressCard: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.DEFAULT, backgroundColor: colors.surface.DEFAULT, padding: 16 },
  progressTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.slate[900] },
  progressSub: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  track: { marginTop: 12, height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.surface.sunken },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand[600] },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  fileName: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  metaText: { fontSize: 12, lineHeight: 16, color: colors.ink.subtle },
  templateBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.muted,
    padding: 12,
  },
  templateTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[900] },
  templateText: { marginTop: 2, fontSize: 11, lineHeight: 16, color: colors.ink.subtle },
  code: { fontFamily: 'monospace', backgroundColor: colors.surface.sunken, fontSize: 11 },
  drop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.DEFAULT,
    backgroundColor: colors.surface.DEFAULT,
    padding: 24,
  },
  dropTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.slate[900], textAlign: 'center' },
})
