import { useEffect, useState } from 'react'
import { HiPrinter, HiClipboardDocument, HiCheck } from 'react-icons/hi2'
import { api } from '../../lib/axios'

// Shows a product's barcode: the scannable EAN-13 image which contains both the
// bars and the formatted human-readable check digits, ready for printing.
export function ProductBarcode({ code, imageUrl, className = '' }) {
  const [objectUrl, setObjectUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const [lastImageUrl, setLastImageUrl] = useState(imageUrl)
  if (imageUrl !== lastImageUrl) {
    setLastImageUrl(imageUrl)
    setFailed(false)
  }

  useEffect(() => {
    if (!imageUrl) return undefined
    let cancelled = false

    api
      .get(imageUrl, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        setObjectUrl(URL.createObjectURL(res.data))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  useEffect(() => () => objectUrl && URL.revokeObjectURL(objectUrl), [objectUrl])

  function handlePrint() {
    if (!objectUrl) return
    const win = window.open('', '_blank', 'width=400,height=300')
    if (!win) return
    win.document.write(
      `<!doctype html><html><head><title>Barcode ${code}</title></head>` +
        `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;">` +
        `<img src="${objectUrl}" style="max-width:90%;" onload="window.print()" /></body></html>`,
    )
    win.document.close()
  }

  function handleCopy() {
    if (!code) return
    navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
          Barcode
        </span>
        <div className="flex items-center gap-2">
          {code && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-2xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              title="Copy barcode number"
            >
              {copied ? (
                <>
                  <HiCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <HiClipboardDocument className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {objectUrl && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
            >
              <HiPrinter className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
        {failed ? (
          <div className="flex flex-col items-center py-2 text-center">
            <span className="text-xs font-semibold text-slate-700 tabular font-mono">{code}</span>
            <span className="mt-1 text-[11px] text-slate-400">Barcode image unavailable</span>
          </div>
        ) : objectUrl ? (
          <img
            src={objectUrl}
            alt={`Barcode ${code}`}
            className="h-16 w-auto max-w-full object-contain"
          />
        ) : (
          <div className="h-16 w-44 animate-pulse rounded-lg bg-slate-100" />
        )}
      </div>
    </div>
  )
}
