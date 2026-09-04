import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'

// The per-row action menu. Items carry an optional `permission`; anything the
// signed-in role cannot do is not rendered at all rather than rendered
// disabled — a menu full of dead entries teaches operators to stop reading it.
export function RowActions({ items = [], label = 'Row actions' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const permissions = useAuthStore((state) => state.permissions)

  const visible = items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  )

  useEffect(() => {
    if (!isOpen) return undefined

    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (visible.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="relative flex justify-end"
      // A row that navigates on click must not navigate when the menu is used.
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="rounded p-1 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="moreHorizontal" className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-1 min-w-[11rem] overflow-hidden rounded-md border border-border bg-surface py-1 shadow-overlay"
        >
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false)
                item.onSelect?.()
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                item.tone === 'danger'
                  ? 'text-danger-700 hover:bg-danger-50'
                  : 'text-ink-muted hover:bg-surface-muted'
              }`}
            >
              {item.icon && <Icon name={item.icon} className="h-3.5 w-3.5" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
