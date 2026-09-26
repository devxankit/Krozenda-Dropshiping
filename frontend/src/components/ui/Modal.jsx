import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

const SIZE_CLASSES = Object.freeze({
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
})

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnOverlayClick = true,
}) {
  const dialogRef = useRef(null)

  // Escape closes, and the page behind must not scroll while a modal owns the
  // screen — both are things every hand-rolled modal forgets exactly once.
  useEffect(() => {
    if (!isOpen) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  // Keyboard users land inside the dialog, and go back to whatever opened it
  // when it closes. Keyed on `isOpen` alone: callers pass inline `onClose`
  // handlers, and re-running this on every render would steal focus from
  // whichever field is being typed in.
  useEffect(() => {
    if (!isOpen) return undefined
    const previousFocus = document.activeElement
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="admin-root fixed inset-0 z-modal flex animate-fade-in items-center justify-center bg-slate-900/40 p-3 font-sans text-ink antialiased backdrop-blur-[2px] sm:p-5"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full animate-scale-in flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-overlay ring-1 ring-slate-900/5 focus:outline-none sm:max-h-[calc(100dvh-2.5rem)] ${SIZE_CLASSES[size]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface px-3.5 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-2xs sm:text-xs leading-snug text-ink-subtle">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-0.5 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="admin-scroll flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 flex-wrap border-t border-border bg-surface-muted px-3.5 py-2.5 sm:px-5 sm:py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
