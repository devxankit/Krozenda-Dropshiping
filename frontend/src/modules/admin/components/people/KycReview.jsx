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

// A stand-in for the document itself. There is no real PDF behind a fixture,
// so this draws the page shape rather than faking a scan.
export function DocumentViewer({ document, declared, footer }) {
  return (
    <SectionCard
      title={document.type}
      description="Check the declared details on the right against what the document says"
      actions={
        <span className="flex items-center gap-1">
          <Button variant="secondary" size="sm" icon="remove" iconOnly aria-label="Zoom out" />
          <span className="tabular w-10 text-center text-2xs text-ink-muted">100%</span>
          <Button variant="secondary" size="sm" icon="add" iconOnly aria-label="Zoom in" />
          <Button variant="secondary" size="sm" icon="download" iconOnly aria-label="Download" />
        </span>
      }
      footer={footer}
    >
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="relative flex h-72 items-center justify-center rounded-lg border border-border bg-surface-sunken">
          <div className="flex h-60 w-52 flex-col gap-2 rounded bg-surface p-4 shadow-raised">
            <div className="h-1.5 w-2/3 rounded-sm bg-border-strong" />
            <div className="h-1 w-2/5 rounded-sm bg-border" />
            <div className="my-1 h-px bg-border" />
            {[88, 76, 81, 58, 70, 46].map((width, index) => (
              <div key={index} className="h-1 rounded-sm bg-border" style={{ width: `${width}%` }} />
            ))}
            <div className="mt-auto flex items-end justify-between">
              <div className="h-7 w-14 rounded-sm border border-dashed border-border-strong" />
              <div className="h-1 w-12 rounded-sm bg-border" />
            </div>
          </div>
          <span className="absolute bottom-2.5 left-3 text-2xs text-ink-faint">Page 1 of 2</span>
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
