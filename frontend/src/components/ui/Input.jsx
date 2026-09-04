import { forwardRef } from 'react'
import { Icon } from './Icon'

const SIZE_CLASSES = Object.freeze({
  sm: 'h-8 text-xs',
  control: 'h-control text-sm',
  md: 'h-10 text-sm',
})

// forwardRef is load-bearing, not ceremony: react-hook-form's `register()`
// attaches to the DOM node through a ref, and on React 18 a plain function
// component silently drops it — the field then reads back as undefined on
// submit while looking perfectly filled in on screen.
export const Input = forwardRef(function Input(
  {
    label,
    error,
    description,
    id,
    size = 'md',
    icon,
    suffix,
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
        {icon && (
          <Icon name={icon} className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint" />
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={`w-full rounded-md border bg-surface text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted disabled:text-ink-faint ${SIZE_CLASSES[size]} ${icon ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} ${error ? 'border-danger-500' : 'border-border'} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs font-medium text-ink-faint">
            {suffix}
          </span>
        )}
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
