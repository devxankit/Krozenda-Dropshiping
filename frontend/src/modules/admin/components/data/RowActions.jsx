import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../../components/ui'
import { useAuthStore } from '../../../../lib/authStore'

// The per-row action menu. Items carry an optional `permission`; anything the
// signed-in role cannot do is not rendered at all rather than rendered
// disabled — a menu full of dead entries teaches operators to stop reading it.
//
// Rendered via a portal so it never gets clipped by table overflow-x/overflow-y
// wrappers, even on 1-row tables where the container height is minimal.
export function RowActions({ items = [], label = 'Row actions' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const permissions = useAuthStore((state) => state.permissions)

  const visible = items.filter(
    (item) => !item.permission || permissions.includes(item.permission),
  )

  function updatePosition() {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const showAbove = spaceBelow < 220 && rect.top > 220

    setCoords({
      top: showAbove ? undefined : rect.bottom + 4,
      bottom: showAbove ? window.innerHeight - rect.top + 4 : undefined,
      right: Math.max(12, window.innerWidth - rect.right),
    })
  }

  function handleToggle(event) {
    event.stopPropagation()
    if (!isOpen) {
      updatePosition()
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return undefined

    function onPointerDown(event) {
      if (
        buttonRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return
      }
      setIsOpen(false)
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    function onScrollOrResize() {
      setIsOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [isOpen])

  if (visible.length === 0) return null

  return (
    <div
      className="relative inline-flex justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Icon name="moreHorizontal" className="h-4 w-4" />
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              right: coords.right,
              zIndex: 9999,
            }}
            className="admin-root min-w-[12rem] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-overlay animate-scale-up"
            onClick={(event) => event.stopPropagation()}
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
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                  item.tone === 'danger'
                    ? 'text-danger-700 hover:bg-danger-50'
                    : 'text-slate-700 hover:bg-surface-muted hover:text-slate-900'
                }`}
              >
                {item.icon && <Icon name={item.icon} className="h-4 w-4 text-ink-faint" />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
