import { forwardRef } from 'react'
import { FIELD_BASE, FieldHint, FieldLabel, fieldStateClass } from './fieldStyles'
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
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <div className="relative flex items-center">
        {icon && <Icon name={icon} className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint" />}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={`${FIELD_BASE} ${SIZE_CLASSES[size]} ${icon ? 'pl-9' : 'pl-3'} ${suffix ? 'pr-12' : 'pr-3'} ${fieldStateClass(error)} ${className}`}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-xs font-medium text-ink-faint">
            {suffix}
          </span>
        )}
      </div>
      <FieldHint id={id} error={error} description={description} />
    </div>
  )
})
