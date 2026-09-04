import { forwardRef } from 'react'

// forwardRef is required for react-hook-form's `register()` to attach — see
// the note in Input.jsx.
export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    description,
    id,
    rows = 4,
    required,
    className = '',
    containerClassName = '',
    ...props
  },
  ref,
) {
  const describedBy = error ? `${id}-error` : description ? `${id}-description` : undefined

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-danger-700">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        className={`rounded-md border bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 ${error ? 'border-danger-500' : 'border-border'} ${className}`}
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs text-danger-700">
          {error}
        </span>
      ) : (
        description && (
          <span id={`${id}-description`} className="text-xs text-ink-faint">
            {description}
          </span>
        )
      )}
    </div>
  )
})
