import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../../components/ui'

const SIDE_CLASSES = Object.freeze({
  right: 'right-0 border-l',
  left: 'left-0 border-r',
})

const WIDTH_CLASSES = Object.freeze({
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
}) {
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

  if (!isOpen) return null

  return createPortal(
    <div className="admin-root fixed inset-0 z-drawer flex transition-all" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-md transition-all" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(event) => event.stopPropagation()}
        className={`absolute inset-y-0 flex w-full flex-col border-border bg-surface shadow-overlay ${SIDE_CLASSES[side]} ${WIDTH_CLASSES[width]}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs leading-snug text-ink-subtle">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="admin-scroll flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body,
  )
}
