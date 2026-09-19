import { useState } from 'react'
import { Badge, Button, Icon } from '../../../../components/ui'
import { REVIEW_STATUS, REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../../constants'
import { KeyValueList, SectionCard } from '../display'

const DOC_ICON = Object.freeze({
  [REVIEW_STATUS.APPROVED]: { name: 'check', wrap: 'bg-success-50 text-success-700' },
  [REVIEW_STATUS.REJECTED]: { name: 'close', wrap: 'bg-danger-50 text-danger-700' },
  [REVIEW_STATUS.REVIEWING]: { name: 'file', wrap: 'bg-brand-50 text-brand-700' },
  [REVIEW_STATUS.SUBMITTED]: { name: 'file', wrap: 'bg-surface-sunken text-ink-subtle' },
  [REVIEW_STATUS.NOT_APPLICABLE]: { name: 'remove', wrap: 'bg-surface-sunken text-ink-faint' },
  [REVIEW_STATUS.CHANGES_REQUESTED]: { name: 'warning', wrap: 'bg-warning-50 text-warning-700' },
})

// No third-party API validates any of these documents (project context §5.1).
// A person reads them and decides, so the list is built for reading: what it
// is, when it arrived, and — when it was rejected — exactly why.
export function DocumentList({ documents = [], selectedId, onSelect }) {
  return (
    <SectionCard
      title="Submitted documents"
      description="Reviewed by a person — no automated verification is performed"
    >
      <ul className="divide-y divide-border-subtle">
        {documents.map((document) => {
          const icon = DOC_ICON[document.status] || DOC_ICON[REVIEW_STATUS.SUBMITTED]
          const selected = document.id === selectedId
          const missing = !document.fileName && document.required

          return (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => onSelect?.(document.id)}
                disabled={!document.fileName}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  selected ? 'border-l-2 border-brand-600 bg-brand-50/40' : 'hover:bg-surface-muted'
                } ${document.fileName ? '' : 'cursor-default'}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${icon.wrap}`}
                >
                  <Icon name={icon.name} className="h-3.5 w-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-xs font-semibold ${document.required ? 'text-slate-900' : 'text-ink-subtle'}`}
                  >
                    {document.type}
                    {!document.required && ' (optional)'}
                  </span>
                  {document.rejectionReason ? (
                    <span className="block text-2xs leading-snug text-danger-700">
                      {document.rejectionReason}
                    </span>
                  ) : document.fileName ? (
                    <span className="tabular block truncate text-2xs text-ink-faint">
                      {document.fileName} · {document.fileSize} · {document.uploadedAt}
                    </span>
                  ) : (
                    <span className="block text-2xs text-ink-faint">
                      {missing ? 'Not uploaded yet' : 'Not required for this seller'}
                    </span>
                  )}
                </span>

                <Badge tone={REVIEW_STATUS_TONE[document.status]} size="sm">
                  {REVIEW_STATUS_LABELS[document.status]}
                </Badge>
              </button>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i
const PDF_EXT = /\.pdf$/i
const ZOOM_STEPS = [50, 75, 100, 125, 150, 200]

// Renders the actual uploaded file — an image inline (zoomable), a PDF in an
// embedded viewer, anything else as a plain download link. `document.url` is
// the real, admin-authenticated-backend-served file (see
// adminKycController.getKycApplication / utils/imageHelper.getImageUrl).
export function DocumentViewer({ document, declared, footer }) {
  const [zoomIndex, setZoomIndex] = useState(2) // 100%
  const zoom = ZOOM_STEPS[zoomIndex]
  const isImage = document.url && IMAGE_EXT.test(document.url)
  const isPdf = document.url && PDF_EXT.test(document.url)

  return (
    <SectionCard
      title={document.type}
      description="Check the declared details on the right against what the document says"
      actions={
        <span className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon="remove"
            iconOnly
            aria-label="Zoom out"
            disabled={!isImage || zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          />
          <span className="tabular w-10 text-center text-2xs text-ink-muted">{isImage ? `${zoom}%` : '—'}</span>
          <Button
            variant="secondary"
            size="sm"
            icon="add"
            iconOnly
            aria-label="Zoom in"
            disabled={!isImage || zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          />
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            iconOnly
            aria-label="Download"
            disabled={!document.url}
            onClick={() => {
              if (!document.url) return
              const link = window.document.createElement('a')
              link.href = document.url
              link.download = document.fileName || ''
              link.target = '_blank'
              link.rel = 'noreferrer'
              link.click()
            }}
          />
        </span>
      }
      footer={footer}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="relative flex h-72 items-center justify-center overflow-auto rounded-lg border border-border bg-surface-sunken">
          {isImage ? (
            <img
              src={document.url}
              alt={document.type}
              className="max-w-none object-contain transition-[width] duration-150"
              style={{ width: `${zoom}%` }}
            />
          ) : isPdf ? (
            <iframe title={document.type} src={document.url} className="h-full w-full rounded-lg" />
          ) : document.url ? (
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-2 text-xs font-semibold text-brand-700 hover:underline"
            >
              <Icon name="file" className="h-8 w-8" />
              Open {document.fileName || 'file'}
            </a>
          ) : (
            <span className="text-xs text-ink-faint">No file uploaded</span>
          )}
        </div>

        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Declared by the seller
          </p>
          <KeyValueList items={declared} />
        </div>
      </div>
    </SectionCard>
  )
}
