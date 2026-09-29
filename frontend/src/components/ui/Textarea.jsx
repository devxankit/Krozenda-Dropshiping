import { forwardRef, useId } from 'react'
import { FIELD_BASE, FieldHint, FieldLabel, fieldStateClass } from './fieldStyles'

// forwardRef is required for react-hook-form's `register()` to attach — see
// the note in Input.jsx.
export const Textarea = forwardRef(function Textarea(
  { label, error, description, id: idProp, rows = 4, required, className = '', containerClassName = '', ...props },
  ref,
) {
  // Every field gets an id, so its label is linked to it (screen readers
  // announce it, and clicking the label focuses the field) even when the
  // caller passes none — most forms in the app do not.
  const autoId = useId()
  const id = idProp || autoId
  const describedBy = error ? `${id}-error` : description ? `${id}-description` : undefined

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required={required}
        className={`${FIELD_BASE} px-3 py-2 text-sm leading-relaxed ${fieldStateClass(error)} ${className}`}
        {...props}
      />
      <FieldHint id={id} error={error} description={description} />
    </div>
  )
})
