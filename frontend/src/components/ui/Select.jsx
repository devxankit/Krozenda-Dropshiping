import { forwardRef } from 'react'
import { FIELD_BASE, FieldHint, FieldLabel, fieldStateClass } from './fieldStyles'
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
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <div className="relative flex items-center">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={`${FIELD_BASE} cursor-pointer appearance-none pl-3 pr-9 ${SIZE_CLASSES[size]} ${fieldStateClass(error)} ${className}`}
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
        <Icon name="chevronDown" className="pointer-events-none absolute right-3 h-4 w-4 text-ink-faint" />
      </div>
      <FieldHint id={id} error={error} description={description} />
    </div>
  )
})
