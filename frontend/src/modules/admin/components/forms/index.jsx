import { Icon } from '../../../../components/ui'

// The form scaffolding every create/edit/settings screen composes from.
// Fields themselves come from components/ui — these are the containers, the
// rhythm and the footer, decided once.

export function FormSection({ title, description, badge, columns = 3, children, footer }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      {(title || badge) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{description}</p>
            )}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}
      <div
        className="grid gap-x-4 gap-y-4 p-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </section>
  )
}

// A field that spans more than one column of the grid above.
export function FormSpan({ span = 2, children }) {
  return <div style={{ gridColumn: `span ${span} / span ${span}` }}>{children}</div>
}

// A row where the label and help sit left and the control sits right —
// the shape settings screens want, as opposed to the stacked grid above.
export function FormRow({ label, description, children, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-900">{label}</p>
        {description && <p className="mt-0.5 text-2xs leading-snug text-ink-faint">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// steps: [{ id, label, hint, state: 'done' | 'current' | 'todo' }]
export function Stepper({ steps = [] }) {
  return (
    <ol className="flex overflow-hidden rounded-lg border border-border bg-surface">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={`flex flex-1 items-center gap-2.5 px-4 py-3 ${
            index > 0 ? 'border-l border-border' : ''
          } ${step.state === 'current' ? 'border-b-2 border-b-brand-600 bg-brand-50/40' : ''}`}
        >
          <span
            className={`tabular flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${
              step.state === 'done'
                ? 'bg-success-700 text-white'
                : step.state === 'current'
                  ? 'bg-brand-600 text-white'
                  : 'border border-border-strong text-ink-faint'
            }`}
            style={{ height: '1.375rem', width: '1.375rem' }}
          >
            {step.state === 'done' ? <Icon name="check" className="h-3 w-3" /> : index + 1}
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate text-xs font-semibold ${step.state === 'todo' ? 'text-ink-subtle' : 'text-slate-900'}`}
            >
              {step.label}
            </span>
            <span
              className={`block truncate text-2xs ${step.state === 'current' ? 'font-medium text-brand-600' : 'text-ink-faint'}`}
            >
              {step.hint}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

// The sticky bar at the bottom of a form screen. It reports what is unsaved
// and says, plainly, that saving is audited.
export function FormActions({ status, note, children }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">{status}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {note && <span className="text-2xs text-ink-faint">{note}</span>}
        {children}
      </div>
    </div>
  )
}

export function UnsavedIndicator({ count, fields = [] }) {
  if (!count) return <span className="text-xs text-ink-faint">No changes yet</span>
  return (
    <>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
      <span className="text-xs font-semibold text-slate-900">
        {count} unsaved {count === 1 ? 'change' : 'changes'}
      </span>
      {fields.length > 0 && (
        <span className="truncate text-xs text-ink-subtle">· {fields.join(', ')}</span>
      )}
    </>
  )
}

// A dropzone that is honest about being a mockup surface: no fake upload
// progress, just the target and its constraints.
export function FileDropzone({ accept = 'CSV or Excel', maxSize = '10 MB', onBrowse }) {
  return (
    <button
      type="button"
      onClick={onBrowse}
      className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-muted px-6 py-8 text-center transition-colors hover:border-brand-500 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <Icon name="upload" className="h-5 w-5 text-ink-faint" />
      <span className="text-xs font-semibold text-slate-900">
        Drop a file here, or click to browse
      </span>
      <span className="text-2xs text-ink-faint">
        {accept} · up to {maxSize}
      </span>
    </button>
  )
}
export { FormDrawer } from './FormDrawer'
