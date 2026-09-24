import { useEffect, useRef, useState } from 'react'
import { HiExclamationTriangle, HiMagnifyingGlass } from 'react-icons/hi2'
import { Modal } from '../ui/Modal'
import { api } from '../../lib/axios'

// A real barcode scanner — the handheld gun kind, or a phone's Bluetooth one
// — is not a camera feed the browser has to read. It behaves exactly like a
// second keyboard: pointed at a label, it "types" the digits into whatever
// field is focused and finishes with Enter. So this needs no camera library
// at all — an ordinary, always-focused text input that submits on Enter IS
// the scan handler, and it doubles as a manual lookup for a label a scanner
// can't get to.
//
// `lookupPath` is a function (code) => API path, so this same component
// serves the admin panel (`/admin/catalog/products/barcode/:code`) and the
// seller panel (`/vendor/products/barcode/:code`, scoped server-side to that
// seller's own catalog) without knowing which one it is.
export function ScanBarcodeModal({ isOpen, onClose, lookupPath, onFound }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | not-found | error
  const inputRef = useRef(null)

  // Reset on every open — done during render (React's own recipe for
  // adjusting state when a prop changes) rather than in an effect, which
  // would paint one frame of the PREVIOUS lookup's leftover state first.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) {
      setCode('')
      setStatus('idle')
    }
  }

  useEffect(() => {
    if (!isOpen) return undefined
    // A scanner fires the instant the modal is on screen — nothing to click
    // first, or the scan lands in the void.
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    // A 2D scanner reading the label's QR code types the whole details line
    // ("2000000000015 | Name | SKU: …"); the barcode is its first field.
    const barcode = trimmed.match(/\d{13}/)?.[0] || trimmed

    setStatus('loading')
    try {
      const res = await api.get(lookupPath(encodeURIComponent(barcode)))
      setStatus('idle')
      setCode('')
      onFound(res.data?.data)
    } catch (err) {
      setStatus(err.response?.status === 404 ? 'not-found' : 'error')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan barcode"
      description="Point a scanner at the label, or type the code and press Enter."
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
          <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              if (status !== 'idle' && status !== 'loading') setStatus('idle')
            }}
            placeholder="0000000000000"
            className="w-full bg-transparent text-sm font-medium tabular text-slate-900 placeholder-ink-faint focus:outline-none"
            autoComplete="off"
          />
        </div>

        {status === 'not-found' && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-danger-600">
            <HiExclamationTriangle className="h-3.5 w-3.5 shrink-0" />
            No product carries this barcode.
          </p>
        )}
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-danger-600">
            <HiExclamationTriangle className="h-3.5 w-3.5 shrink-0" />
            Something went wrong — try again.
          </p>
        )}

        {/* No visible submit button: a scanner's own Enter keystroke, or the
            buyer's, is the only way this is meant to be used. */}
        <button type="submit" className="sr-only">
          Look up
        </button>
      </form>
    </Modal>
  )
}
