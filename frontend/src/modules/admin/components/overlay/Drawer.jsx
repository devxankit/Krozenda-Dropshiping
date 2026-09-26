import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../../components/ui'

const SIDE_CLASSES = Object.freeze({
  right: 'right-0 border-l',
  left: 'left-0 border-r',
})

const ENTER_ANIMATION = Object.freeze({
  right: 'animate-slide-in-right',
  left: 'animate-slide-in-left',
})

const WIDTH_CLASSES = Object.freeze({
  // Navigation drawer: leaves a strip of the page visible on a phone, which
  // is what tells the user they can tap outside to get back.
  nav: '!w-[85vw] max-w-[18rem]',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
})

// The workhorse overlay of the panel: quick view from a table row, a filter
// sheet, the notifications tray, the mobile nav. A drawer keeps the list
// behind it visible, which is why list screens reach for it over a modal.
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  side = 'right',
  width = 'md',
  footer,
  children,
  ariaLabel,
}) {
  const panelRef = useRef(null)

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

  // Same focus contract as Modal, and keyed on `isOpen` alone for the same
  // reason: an inline `onClose` must not steal focus on every render.
  useEffect(() => {
    if (!isOpen) return undefined
    const previousFocus = document.activeElement
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) previousFocus.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="admin-root fixed inset-0 z-drawer flex" onClick={onClose}>
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
        onClick={(event) => event.stopPropagation()}
        className={`absolute inset-y-0 flex w-full flex-col border-border bg-surface shadow-overlay focus:outline-none ${SIDE_CLASSES[side]} ${ENTER_ANIMATION[side]} ${WIDTH_CLASSES[width]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3.5 py-3 sm:px-5 sm:py-4">
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

        <div className="admin-scroll flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-muted px-3.5 py-2.5 sm:px-5 sm:py-3">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}
