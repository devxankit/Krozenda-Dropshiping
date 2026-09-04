import { forwardRef } from 'react'
import { Icon } from './Icon'

const SIZE_CLASSES = Object.freeze({
  sm: 'h-8 text-xs',
  control: 'h-control text-sm',
  md: 'h-10 text-sm',
})

// forwardRef is required for react-hook-form's `register()` to attach — see
// the note in Input.jsx.
export const Select = forwardRef(function Select(
  {
    label,
    error,
    description,
    id,
    options = [],
    placeholder,
    size = 'md',
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
      <div className="relative flex items-center">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={`w-full appearance-none rounded-md border bg-surface pl-3 pr-9 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted disabled:text-ink-faint ${SIZE_CLASSES[size]} ${error ? 'border-danger-500' : 'border-border'} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute right-3 h-4 w-4 text-ink-faint"
        />
      </div>
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
