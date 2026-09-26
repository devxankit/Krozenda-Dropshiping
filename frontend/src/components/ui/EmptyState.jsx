import { Icon } from './Icon'

// The icon sits in a soft tile so an empty list reads as a designed state,
// not as a table that failed to render.
export function EmptyState({ icon = 'info', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-sunken text-ink-subtle ring-1 ring-inset ring-border">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <div className="max-w-sm">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-subtle">{description}</p>}
      </div>
      {action}
    </div>
  )
}
