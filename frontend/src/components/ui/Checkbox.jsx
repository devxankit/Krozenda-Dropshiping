import { Icon } from './Icon'

// `indeterminate` is what a table's header checkbox shows when some but not
// all rows are selected — a state a bare <input type="checkbox"> can only
// express through a DOM property, so it is drawn rather than relied on.
export function Checkbox({
  id,
  label,
  description,
  checked = false,
  indeterminate = false,
  disabled = false,
  onChange,
  className = '',
}) {
  const isOn = checked || indeterminate

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-start gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          aria-checked={indeterminate ? 'mixed' : checked}
          className="peer absolute h-4 w-4 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1 ${isOn ? 'border-brand-600 bg-brand-600 text-white' : 'border-border-strong bg-surface'}`}
        >
          {indeterminate ? (
            <Icon name="remove" className="h-3 w-3" />
          ) : (
            checked && <Icon name="check" className="h-3 w-3" />
          )}
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5 leading-tight">
          {label && <span className="text-sm text-slate-800">{label}</span>}
          {description && <span className="text-xs text-ink-faint">{description}</span>}
        </span>
      )}
    </label>
  )
}
