import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import * as Clipboard from 'expo-clipboard'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { Icon, Skeleton, Text } from '../ui'
import { api } from '../../lib/axios'
import { toast } from '../../lib/toast'
import { colors, radius, shadows } from '../../theme'
import { formatRupees as formatRupeesOrDash } from '../catalog/tw'

// A product's label: a classic barcode of the SKU (what a scanner gun reads —
// it types the SKU into the panel's "Scan barcode" box, which opens the
// product) next to a QR code that carries the product's details themselves,
// so a phone camera shows name, SKU and price with no login.
//
// `qrUrl` and `product` are optional — without them this is just the barcode.
// Both images come from the API behind auth, so they are fetched with the
// bearer token (as bytes) rather than dropped into an <Image source={{ uri }}>.
//
// Native differences from the web: "Download label" / "Print" build the label as an HTML page and hand
// it to expo-print (PDF file shared through the system share sheet / the system print dialog), and
// "Barcode PNG" writes the fetched PNG to the cache and shares it.

function formatRupees(amount) {
  if (amount === null || amount === undefined || amount === '') return null
  return formatRupeesOrDash(amount)
}

// The price a buyer pays today, and the MRP only when it is actually higher.
function labelPrices(product) {
  if (!product) return { price: null, mrp: null }
  const selling =
    product.salePrice != null && Number(product.salePrice) < Number(product.price) ? product.salePrice : product.price
  const mrp = product.mrp != null && Number(product.mrp) > Number(selling) ? product.mrp : null
  return { price: formatRupees(selling), mrp: formatRupees(mrp) }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytesToBase64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)]
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '='
    out += i + 2 < bytes.length ? B64[c & 63] : '='
  }
  return out
}

// PNG width/height live in the IHDR chunk (bytes 16-23, big-endian).
function pngSize(bytes) {
  if (bytes.length < 24 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const EMPTY = { url: null, bytes: null, base64: null, size: null, failed: false }

function useAuthedImage(url) {
  const [state, setState] = useState(EMPTY)

  const [lastUrl, setLastUrl] = useState(url)
  if (url !== lastUrl) {
    setLastUrl(url)
    setState(EMPTY)
  }

  useEffect(() => {
    if (!url) return undefined
    let cancelled = false

    api
      .get(url, { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return
        const bytes = new Uint8Array(res.data)
        const base64 = bytesToBase64(bytes)
        setState({ url: `data:image/png;base64,${base64}`, bytes, base64, size: pngSize(bytes), failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ ...EMPTY, failed: true })
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return state
}

const esc = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

// The printable label: name, SKU, price on top; barcode and QR side by side below. The barcode is never
// smoothed — bar widths are what a scanner reads.
function buildLabelHtml({ barcodeSrc, qrSrc, product, code }) {
  const { price, mrp } = labelPrices(product)
  const meta = [product?.sku ? `SKU: ${product.sku}` : null, price ? `Price: ${price}` : null, mrp ? `MRP: ${mrp}` : null]
    .filter(Boolean)
    .map(esc)
    .join('&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;')
  const nameHtml = product?.name ? `<div class="name">${esc(product.name)}</div>` : ''
  const metaHtml = meta ? `<div class="meta">${meta}</div>` : ''
  const head = nameHtml || metaHtml ? `<div class="head">${nameHtml}${metaHtml}</div>` : ''
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Label ${esc(code)}</title>` +
    `<style>@page{margin:6mm}body{margin:0;font-family:sans-serif;color:#0f172a}` +
    `.label{border:1px solid #cbd5e1;padding:18px}.name{font-weight:700;font-size:18px;line-height:1.3;max-height:2.6em;overflow:hidden}` +
    `.meta{margin-top:4px;font-size:13px;color:#334155}.head{margin-bottom:10px}` +
    `.codes{display:flex;align-items:center;justify-content:space-between;gap:16px}` +
    `.codes img{image-rendering:pixelated}.bar{max-width:100%;max-height:130px}.qr{width:130px;height:130px}</style>` +
    `</head><body><div class="label">${head}<div class="codes"><img class="bar" src="${barcodeSrc}" />` +
    `${qrSrc ? `<img class="qr" src="${qrSrc}" />` : ''}</div></div></body></html>`
  )
}

function ActionButton({ icon, label, onPress, disabled, tone, mono }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, shadows['2xs'], disabled && { opacity: 0.5 }, pressed && { backgroundColor: colors.slate[50] }]}
    >
      <Icon name={icon} size={14} color={tone || colors.slate[700]} />
      <Text noTranslate={mono} style={[styles.actionText, tone && { color: tone }, mono && { fontFamily: 'monospace' }]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function ProductBarcode({ code, imageUrl, qrUrl, product, style }) {
  const barcode = useAuthedImage(imageUrl)
  const qr = useAuthedImage(qrUrl)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const { price, mrp } = labelPrices(product)
  // The QR is an extra; a label is still worth downloading without it.
  const ready = Boolean(barcode.url) && (!qrUrl || qr.url || qr.failed)
  const fileBase = `${product?.sku || 'product'}-${code}`.replace(/[^\w.-]+/g, '_')

  const html = () => buildLabelHtml({ barcodeSrc: barcode.url, qrSrc: qr.url, product, code })

  async function handleDownloadLabel() {
    if (!ready) return
    setBusy(true)
    try {
      const { base64 } = await Print.printToFileAsync({ html: html(), width: 450, height: 300, base64: true })
      const file = new File(Paths.cache, `label-${fileBase}.pdf`)
      file.create({ overwrite: true })
      file.write(base64, { encoding: 'base64' })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `label-${fileBase}.pdf` })
      }
    } catch {
      toast.error('Could not create the label')
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadBarcode() {
    if (!barcode.bytes) return
    try {
      const file = new File(Paths.cache, `barcode-${fileBase}.png`)
      file.create({ overwrite: true })
      file.writeBytes(barcode.bytes)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `barcode-${fileBase}.png` })
      }
    } catch {
      toast.error('Could not save the barcode')
    }
  }

  async function handlePrint() {
    if (!ready) return
    try {
      await Print.printAsync({ html: html() })
    } catch {
      // The system print dialog being dismissed is not an error.
    }
  }

  async function handleCopy() {
    if (!code) return
    await Clipboard.setStringAsync(String(code))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const bSize = barcode.size

  return (
    <View style={[{ gap: 10 }, style]}>
      <Text style={styles.heading}>Barcode label</Text>

      <View style={[styles.card, shadows['2xs']]}>
        {product?.name ? (
          <View style={{ marginBottom: 12, gap: 2 }}>
            <Text numberOfLines={2} style={styles.name}>
              {product.name}
            </Text>
            <View style={styles.meta}>
              {product.sku ? <Text style={styles.metaText}>SKU: {product.sku}</Text> : null}
              {price ? <Text style={styles.metaText}>Price: {price}</Text> : null}
              {mrp ? <Text style={[styles.metaText, { color: colors.slate[400], textDecorationLine: 'line-through' }]}>MRP: {mrp}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.codes}>
          {barcode.failed ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text noTranslate style={styles.failedCode}>
                {code}
              </Text>
              <Text style={styles.failedNote}>Barcode image unavailable</Text>
            </View>
          ) : barcode.url ? (
            <Image
              source={{ uri: barcode.url }}
              accessibilityLabel={`Barcode for SKU ${product?.sku || code}`}
              contentFit="contain"
              style={
                bSize
                  ? { width: bSize.width, maxWidth: '100%', aspectRatio: bSize.width / bSize.height }
                  : { width: '100%', aspectRatio: 3 }
              }
            />
          ) : (
            <Skeleton style={{ height: 112, width: 288, maxWidth: '100%', borderRadius: radius.lg }} />
          )}

          {qrUrl && !qr.failed ? (
            qr.url ? (
              <Image
                source={{ uri: qr.url }}
                accessibilityLabel="QR code with product details"
                contentFit="contain"
                style={{ height: 128, width: 128 }}
              />
            ) : (
              <Skeleton style={{ height: 128, width: 128, borderRadius: radius.lg }} />
            )
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <ActionButton icon="HiArrowDownTray" label="Download label" onPress={handleDownloadLabel} disabled={!ready || busy} />
        <ActionButton icon="HiArrowDownTray" label="Barcode PNG" onPress={handleDownloadBarcode} disabled={!barcode.bytes} />
        <ActionButton icon="HiPrinter" label="Print" onPress={handlePrint} disabled={!ready} />
        {code ? (
          copied ? (
            <ActionButton icon="HiCheck" label="Copied" tone={colors.emerald[600]} onPress={handleCopy} />
          ) : (
            <ActionButton icon="HiClipboardDocument" label={String(code)} mono onPress={handleCopy} />
          )
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.slate[500] },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: '#fff',
    padding: 16,
  },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.slate[900] },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  metaText: { fontSize: 11, lineHeight: 16, fontWeight: '500', color: colors.slate[600] },
  codes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16 },
  failedCode: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
  failedNote: { marginTop: 4, fontSize: 11, color: colors.slate[400] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: colors.slate[700] },
})
