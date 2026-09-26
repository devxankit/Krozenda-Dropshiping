import { Icon } from './Icon'

// One look for every text-like control — Input, Select and Textarea used to
// carry three slightly different focus rings, which is exactly the kind of
// drift that makes a form feel assembled rather than designed.

export const FIELD_BASE =
  'w-full rounded-md border bg-surface text-slate-900 shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-ink-faint focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint disabled:shadow-none'

export function fieldStateClass(error) {
  return error
    ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
    : 'border-border hover:border-border-strong focus:border-brand-500 focus:ring-brand-500/15'
}

export function FieldLabel({ htmlFor, required, children }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {children}
      {required && (
        <span className="text-danger-700" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}

// Error wins over the helper line, and both are wired to the control through
// aria-describedby by the caller, so a screen reader hears the same thing the
// eye reads.
export function FieldHint({ id, error, description }) {
  if (error) {
    return (
      <span id={`${id}-error`} role="alert" className="flex items-start gap-1 text-xs text-danger-700">
        <Icon name="danger" className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </span>
    )
  }
  if (!description) return null
  return (
    <span id={`${id}-description`} className="text-xs leading-snug text-ink-subtle">
      {description}
    </span>
  )
}
