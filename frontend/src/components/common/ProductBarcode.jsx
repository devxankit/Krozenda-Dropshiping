import { useEffect, useState } from 'react'
import { HiPrinter, HiClipboardDocument, HiCheck, HiArrowDownTray } from 'react-icons/hi2'
import { api } from '../../lib/axios'

// A product's label: the scannable EAN-13 (what a USB/Bluetooth scanner gun
// reads — it types the 13 digits into the panel's "Scan barcode" box, which
// opens the product) next to a QR code that carries the product's details
// themselves, so a phone camera shows name, SKU and price with no login.
//
// `qrUrl` and `product` are optional — without them this is just the barcode.
// Both images come from the API behind auth, so they are fetched as blobs
// rather than dropped into an <img src>.

function formatRupees(amount) {
  if (amount === null || amount === undefined || amount === '') return null
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// The price a buyer pays today, and the MRP only when it is actually higher.
function labelPrices(product) {
  if (!product) return { price: null, mrp: null }
  const selling =
    product.salePrice != null && Number(product.salePrice) < Number(product.price) ? product.salePrice : product.price
  const mrp = product.mrp != null && Number(product.mrp) > Number(selling) ? product.mrp : null
  return { price: formatRupees(selling), mrp: formatRupees(mrp) }
}

function useAuthedImage(url) {
  const [state, setState] = useState({ url: null, blob: null, failed: false })

  const [lastUrl, setLastUrl] = useState(url)
  if (url !== lastUrl) {
    setLastUrl(url)
    setState({ url: null, blob: null, failed: false })
  }

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false
    let objectUrl = null

    api
      .get(url, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(res.data)
        setState({ url: objectUrl, blob: res.data, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, blob: null, failed: true })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return state
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

// Draws the printable label onto a canvas: name, SKU, price on top; barcode
// and QR side by side below. Everything is drawn at 2x a typical label's
// on-screen size so it stays sharp on a 203/300 dpi label printer.
async function renderLabelCanvas({ barcodeSrc, qrSrc, product }) {
  const [barcodeImg, qrImg] = await Promise.all([loadImage(barcodeSrc), qrSrc ? loadImage(qrSrc) : null])

  const width = 1000
  const pad = 36
  const gap = 32
  const codesHeight = 260
  const qrSize = qrImg ? codesHeight : 0
  const barcodeMaxWidth = width - pad * 2 - (qrImg ? qrSize + gap : 0)
  const barcodeScale = Math.min(barcodeMaxWidth / barcodeImg.width, codesHeight / barcodeImg.height)
  const barcodeW = barcodeImg.width * barcodeScale
  const barcodeH = barcodeImg.height * barcodeScale

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const font = '"Inter", "Segoe UI", system-ui, sans-serif'

  ctx.font = `700 36px ${font}`
  const nameLines = product?.name ? wrapLines(ctx, product.name, width - pad * 2, 2) : []
  const { price, mrp } = labelPrices(product)
  const meta = [product?.sku ? `SKU: ${product.sku}` : null, price ? `Price: ${price}` : null, mrp ? `MRP: ${mrp}` : null]
    .filter(Boolean)
    .join('   ·   ')

  const headerHeight = nameLines.length * 46 + (meta ? 40 : 0) + (nameLines.length || meta ? 20 : 0)
  canvas.width = width
  canvas.height = pad + headerHeight + codesHeight + pad

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

  let y = pad
  ctx.fillStyle = '#0f172a'
  ctx.textBaseline = 'top'
  ctx.font = `700 36px ${font}`
  for (const line of nameLines) {
    ctx.fillText(line, pad, y)
    y += 46
  }
  if (meta) {
    ctx.font = `500 26px ${font}`
    ctx.fillStyle = '#334155'
    ctx.fillText(meta, pad, y + 2)
    y += 40
  }
  if (nameLines.length || meta) y += 20

  // The EAN-13 is never stretched — bar widths are what a scanner reads.
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(barcodeImg, pad, y + (codesHeight - barcodeH) / 2, barcodeW, barcodeH)
  if (qrImg) ctx.drawImage(qrImg, width - pad - qrSize, y, qrSize, qrSize)

  return canvas
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const ACTION_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-2xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export function ProductBarcode({ code, imageUrl, qrUrl, product, className = '' }) {
  const barcode = useAuthedImage(imageUrl)
  const qr = useAuthedImage(qrUrl)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const { price, mrp } = labelPrices(product)
  // The QR is an extra; a label is still worth downloading without it.
  const ready = Boolean(barcode.url) && (!qrUrl || qr.url || qr.failed)
  const fileBase = `${product?.sku || 'product'}-${code}`.replace(/[^\w.-]+/g, '_')

  async function buildLabel() {
    return renderLabelCanvas({ barcodeSrc: barcode.url, qrSrc: qr.url, product })
  }

  async function handleDownloadLabel() {
    if (!ready) return
    setBusy(true)
    try {
      const canvas = await buildLabel()
      canvas.toBlob((blob) => blob && downloadBlob(blob, `label-${fileBase}.png`), 'image/png')
    } finally {
      setBusy(false)
    }
  }

  function handleDownloadBarcode() {
    if (barcode.blob) downloadBlob(barcode.blob, `barcode-${fileBase}.png`)
  }

  async function handlePrint() {
    if (!ready) return
    // Opened before the await so the browser still treats it as a click.
    const win = window.open('', '_blank', 'width=600,height=400')
    if (!win) return
    const canvas = await buildLabel()
    win.document.write(
      `<!doctype html><html><head><title>Label ${code}</title>` +
        `<style>@page{margin:6mm}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}img{max-width:100%}</style>` +
        `</head><body><img src="${canvas.toDataURL('image/png')}" onload="window.print()" /></body></html>`,
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
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Barcode label</span>

      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
        {product?.name && (
          <div className="mb-3 flex flex-col gap-0.5">
            <span className="line-clamp-2 text-sm font-bold text-slate-900">{product.name}</span>
            <span className="flex flex-wrap gap-x-3 text-2xs font-medium text-slate-600">
              {product.sku && <span>SKU: {product.sku}</span>}
              {price && <span className="tabular">Price: {price}</span>}
              {mrp && <span className="tabular text-slate-400 line-through">MRP: {mrp}</span>}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-between">
          {barcode.failed ? (
            <div className="flex flex-col items-center py-2 text-center">
              <span className="font-mono text-xs font-semibold tabular text-slate-700">{code}</span>
              <span className="mt-1 text-[11px] text-slate-400">Barcode image unavailable</span>
            </div>
          ) : barcode.url ? (
            <img src={barcode.url} alt={`Barcode ${code}`} className="h-24 w-auto max-w-full object-contain [image-rendering:pixelated]" />
          ) : (
            <div className="h-24 w-56 animate-pulse rounded-lg bg-slate-100" />
          )}

          {qrUrl &&
            !qr.failed &&
            (qr.url ? (
              <img
                src={qr.url}
                alt="QR code with product details"
                title="Scan with a phone camera to see the product details"
                className="h-24 w-24 object-contain [image-rendering:pixelated]"
              />
            ) : (
              <div className="h-24 w-24 animate-pulse rounded-lg bg-slate-100" />
            ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleDownloadLabel} disabled={!ready || busy} className={ACTION_CLASS}>
          <HiArrowDownTray className="h-3.5 w-3.5" />
          Download label
        </button>
        <button type="button" onClick={handleDownloadBarcode} disabled={!barcode.blob} className={ACTION_CLASS}>
          <HiArrowDownTray className="h-3.5 w-3.5" />
          Barcode PNG
        </button>
        <button type="button" onClick={handlePrint} disabled={!ready} className={ACTION_CLASS}>
          <HiPrinter className="h-3.5 w-3.5" />
          Print
        </button>
        {code && (
          <button type="button" onClick={handleCopy} className={ACTION_CLASS} title="Copy barcode number">
            {copied ? (
              <>
                <HiCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <HiClipboardDocument className="h-3.5 w-3.5" />
                <span className="font-mono tabular">{code}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
