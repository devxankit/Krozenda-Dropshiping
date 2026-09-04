import { useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../../../../components/ui'

const FORMATS = Object.freeze([
  { id: 'csv', label: 'CSV', hint: 'Spreadsheet-friendly, all columns' },
  { id: 'xlsx', label: 'Excel', hint: 'Formatted, with the current filters applied' },
  { id: 'pdf', label: 'PDF', hint: 'Print layout, visible columns only' },
])

export function ExportMenu({ onExport, label = 'Export', disabled = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="control"
        icon="download"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-overlay"
        >
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onExport?.(format.id)
              }}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
            >
              <Icon name="file" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{format.label}</span>
                <span className="block text-2xs leading-snug text-ink-faint">{format.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
