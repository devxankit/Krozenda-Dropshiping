import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../../../components/ui'
import { flatNavItems } from '../../lib/nav'

// Jumps to any screen in the panel. Built off NAV_TREE so a new screen is
// searchable the moment it is added to the nav, with nothing to register here.
//
// The closed case returns before the body mounts, so the query and highlight
// reset by unmounting rather than by an effect that clears them on open.
export function CommandPalette({ isOpen, onClose, permissions = [] }) {
  if (!isOpen) return null
  return <CommandPaletteBody onClose={onClose} permissions={permissions} />
}

function CommandPaletteBody({ onClose, permissions }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const results = useMemo(() => {
    const granted = new Set(permissions)
    const items = flatNavItems().filter((item) => !item.permission || granted.has(item.permission))
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.group.toLowerCase().includes(term),
    )
  }, [query, permissions])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlighted((index) => Math.min(index + 1, results.length - 1))
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlighted((index) => Math.max(index - 1, 0))
      }
      if (event.key === 'Enter' && results[highlighted]) {
        navigate(results[highlighted].to)
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [results, highlighted, navigate, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-palette flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the admin panel"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Icon name="search" className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlighted(0)
            }}
            placeholder="Jump to a screen…"
            className="h-12 w-full bg-transparent text-sm text-slate-900 placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 text-2xs font-medium text-ink-subtle">
            ESC
          </kbd>
        </div>

        <div className="admin-scroll max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-subtle">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((item, index) => (
              <button
                key={item.to}
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => {
                  navigate(item.to)
                  onClose()
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  index === highlighted ? 'bg-brand-50 text-brand-700' : 'text-ink-muted'
                }`}
              >
                <Icon name={item.icon} className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="font-medium">{item.label}</span>
                <span className="ml-auto text-2xs uppercase tracking-wider text-ink-faint">
                  {item.group}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
