import { forwardRef, useState } from 'react'
import { Icon } from './Icon'

const SIZE_CLASSES = Object.freeze({
  sm: 'h-8 text-xs',
  control: 'h-control text-sm',
  md: 'h-10 text-sm',
})

// Same field as Input, but a password can't use Input's `suffix` slot for
// the visibility toggle — that slot is pointer-events-none by design (it's
// for static text like a currency code), and a toggle has to be clickable.
export const PasswordInput = forwardRef(function PasswordInput(
  {
    label,
    error,
    description,
    id,
    size = 'md',
    icon,
    required,
    className = '',
    containerClassName = '',
    ...props
  },
  ref,
) {
  const [visible, setVisible] = useState(false)
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
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={`w-full rounded-md border bg-surface text-slate-900 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-surface-muted disabled:text-ink-faint ${SIZE_CLASSES[size]} ${icon ? 'pl-9' : 'pl-3'} pr-10 ${error ? 'border-danger-500' : 'border-border'} ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-2 rounded p-1 text-ink-faint transition-colors hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Icon name={visible ? 'hide' : 'show'} className="h-4 w-4" />
        </button>
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
