// A switch commits immediately; a checkbox waits for a Save. Use this only
// where flipping it is the action (feature on/off), not inside a form the
// user has to submit.
export function Switch({
  id,
  checked = false,
  disabled = false,
  onChange,
  label,
  description,
  className = '',
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}
    >
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer absolute h-5 w-9 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1 ${checked ? 'bg-brand-600' : 'bg-border-strong'}`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow-card transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5 leading-tight">
          {label && <span className="text-sm font-medium text-slate-800">{label}</span>}
          {description && (
            <span className="text-xs leading-snug text-ink-faint">{description}</span>
          )}
        </span>
      )}
    </label>
  )
}
