// One supplier's tax invoice for an order. An order with items from several suppliers has several
// of these - Krozenda's (own stock, CJ Dropshipping and shipping) and one per seller - each
// printed with that supplier's own GSTIN. Everything shown comes from GET /user/orders/:id/invoice;
// nothing here decides GST treatment.
//
// Exports:
//   OrderInvoices        - native (react-native views) rendering of the invoice set, for the
//                          preview / download screens.
//   buildInvoiceHtml     - the same layout as printable HTML (expo-print input).
//   printInvoice         - system print dialog (Android print preview, "Save as PDF").
//   shareInvoicePdf      - renders the HTML to a PDF file and opens the Android share sheet.
import { View, ScrollView, StyleSheet, Platform } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { Text } from '../../../../components/ui/Text'
import { colors, shadows } from '../../../../theme'

const rupees = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TAX_TYPE_LABEL = Object.freeze({
  INTRA: 'Intra-State: CGST + SGST',
  INTER: 'Inter-State: IGST',
  NONE: 'No GST charged',
})

const MONO = Platform.select({ android: 'monospace', default: 'Courier' })

function formatAddress(address = {}) {
  return [address.addressLine || address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Native rendering
// ---------------------------------------------------------------------------

// Column widths of the line-item table (the web scrolls it horizontally on a phone as well).
const COLS = { desc: 150, hsn: 64, qty: 36, rate: 76, taxable: 80, gst: 48, tax: 70, total: 84 }

function Cell({ w, children, align = 'left', mono, bold, color, noTranslate = true, style }) {
  return (
    <View style={{ width: w, paddingVertical: 8, paddingHorizontal: 6 }}>
      <Text
        noTranslate={noTranslate}
        style={[
          { fontSize: 11, lineHeight: 16.5, textAlign: align, color: color || colors.slate[800], fontWeight: bold ? '700' : '400' },
          mono && { fontFamily: MONO },
          style,
        ]}
      >
        {children}
      </Text>
    </View>
  )
}

function Row({ label, value, color, mono = true, strong }) {
  return (
    <View style={styles.kv}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: color || colors.slate[600], fontWeight: strong ? '800' : '400' }}>{label}</Text>
      <Text noTranslate style={{ fontSize: 12, lineHeight: 16, color: color || colors.slate[600], fontFamily: mono ? MONO : undefined }}>
        {value}
      </Text>
    </View>
  )
}

export function TaxInvoiceDocument({ data, invoice, index, count }) {
  const { supplier, totals } = invoice
  const buyerAddress = data.buyer.address || {}
  const date = formatDate(data.invoiceDate)
  const isPlatform = supplier.kind === 'PLATFORM'
  const isBillOfSupply = invoice.documentType === 'BILL_OF_SUPPLY'
  const supplierAddress = formatAddress(supplier.address)

  return (
    <View style={styles.doc}>
      {/* Supplier (whoever sold these items) */}
      <View style={styles.section}>
        <View>
          {isPlatform ? (
            <Text noTranslate style={styles.platformName}>
              {supplier.name}
            </Text>
          ) : (
            <>
              <Text style={styles.soldBy}>SOLD BY</Text>
              <Text noTranslate style={styles.sellerName}>
                {supplier.name}
              </Text>
            </>
          )}
          {supplier.legalName && supplier.legalName !== supplier.name ? (
            <Text noTranslate style={styles.legalName}>
              {supplier.legalName}
            </Text>
          ) : null}
          {supplierAddress ? (
            <Text noTranslate style={styles.small500}>
              {supplierAddress}
              {supplier.address.pincode ? ` - ${supplier.address.pincode}` : ''}
            </Text>
          ) : null}
          <Text style={styles.gstinLine}>
            {supplier.gstin ? (
              <>
                GSTIN:{' '}
                <Text noTranslate style={{ fontFamily: MONO, fontSize: 10, color: colors.slate[900] }}>
                  {supplier.gstin}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 10, color: colors.amber[700], fontWeight: '600' }}>Not registered under GST</Text>
            )}
            {supplier.stateCode ? ` | State Code: ${supplier.stateCode}` : ''}
          </Text>
          {!isPlatform ? <Text style={[styles.small500, { marginTop: 2 }]}>Sold on Krozenda Marketplace</Text> : null}
        </View>

        <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
          <View style={styles.docTypePill}>
            <Text style={styles.docTypeText}>{isBillOfSupply ? 'BILL OF SUPPLY' : 'TAX INVOICE'}</Text>
          </View>
          <Text style={styles.invNo}>
            Invoice:{' '}
            <Text noTranslate style={{ fontFamily: MONO, fontSize: 11, color: colors.slate[800] }}>
              {invoice.invoiceNumber}
            </Text>
          </Text>
          <Text noTranslate style={styles.small500}>{`Date: ${date}`}</Text>
          <Text style={styles.small500}>
            Order Ref:{' '}
            <Text noTranslate style={{ fontFamily: MONO, fontSize: 10, color: colors.slate[500] }}>
              {data.orderNumber}
            </Text>
          </Text>
          {count > 1 ? <Text noTranslate style={styles.small500}>{`Invoice ${index + 1} of ${count}`}</Text> : null}
        </View>
      </View>

      {/* Buyer */}
      <View style={[styles.section, { gap: 16 }]}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.soldBy}>BILLED TO</Text>
            {data.buyer.isB2B ? (
              <View style={styles.b2bBadge}>
                <Text style={styles.b2bBadgeText}>B2B Buyer (ITC Eligible)</Text>
              </View>
            ) : null}
          </View>
          <Text noTranslate style={styles.buyerName}>
            {data.buyer.companyName || data.buyer.name}
          </Text>
          {data.buyer.gstin ? (
            <Text style={styles.buyerGstin}>
              Buyer GSTIN:{' '}
              <Text noTranslate style={{ fontFamily: MONO, fontSize: 11, color: colors.blue[700] }}>
                {data.buyer.gstin}
              </Text>
            </Text>
          ) : null}
          <Text noTranslate style={styles.buyerAddr}>{`${formatAddress(buyerAddress)} - ${buyerAddress.pincode}`}</Text>
          <Text noTranslate style={styles.phone}>{`Phone: ${buyerAddress.phone}`}</Text>
        </View>

        <View>
          <Text style={styles.soldBy}>SHIPPED TO</Text>
          <Text noTranslate style={styles.shipName}>
            {data.buyer.name}
          </Text>
          <Text noTranslate style={styles.buyerAddr}>{`${formatAddress(buyerAddress)} - ${buyerAddress.pincode}`}</Text>
          <Text noTranslate style={styles.phone}>
            {`Place of Supply: ${data.placeOfSupply.stateName}${data.placeOfSupply.stateCode ? ` (${data.placeOfSupply.stateCode})` : ''}`}
          </Text>
          <Text noTranslate style={[styles.phone, { marginTop: 0 }]}>{`Payment: ${data.paymentMethod}`}</Text>
        </View>
      </View>

      {/* Lines */}
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View>
          <View style={styles.thead}>
            <Cell w={COLS.desc} bold color={colors.slate[700]} noTranslate={false} style={styles.th}>DESCRIPTION</Cell>
            <Cell w={COLS.hsn} bold align="center" color={colors.slate[700]} noTranslate={false} style={styles.th}>HSN</Cell>
            <Cell w={COLS.qty} bold align="center" color={colors.slate[700]} noTranslate={false} style={styles.th}>QTY</Cell>
            <Cell w={COLS.rate} bold align="right" color={colors.slate[700]} noTranslate={false} style={styles.th}>RATE</Cell>
            <Cell w={COLS.taxable} bold align="right" color={colors.slate[700]} noTranslate={false} style={styles.th}>TAXABLE</Cell>
            <Cell w={COLS.gst} bold align="center" color={colors.slate[700]} noTranslate={false} style={styles.th}>GST %</Cell>
            <Cell w={COLS.tax} bold align="right" color={colors.slate[700]} noTranslate={false} style={styles.th}>TAX</Cell>
            <Cell w={COLS.total} bold align="right" color={colors.slate[700]} noTranslate={false} style={styles.th}>TOTAL</Cell>
          </View>

          {invoice.items.map((item, idx) => (
            <View key={idx} style={styles.tr}>
              <View style={{ width: COLS.desc, paddingVertical: 8, paddingHorizontal: 6 }}>
                <Text noTranslate style={{ fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] }}>
                  {item.name}
                </Text>
                {item.variant ? (
                  <Text noTranslate style={{ fontSize: 10, lineHeight: 15, color: colors.slate[500] }}>{`Variant: ${item.variant}`}</Text>
                ) : null}
                {item.discount > 0 ? (
                  <Text noTranslate style={{ fontSize: 10, lineHeight: 15, color: colors.emerald[700] }}>
                    {`Discount: − ${rupees(item.discount)}`}
                  </Text>
                ) : null}
              </View>
              <Cell w={COLS.hsn} align="center" mono color={colors.slate[600]} style={{ fontSize: 10 }}>
                {item.hsnCode || '—'}
              </Cell>
              <Cell w={COLS.qty} align="center" bold>
                {String(item.quantity)}
              </Cell>
              <Cell w={COLS.rate} align="right" mono>
                {rupees(item.unitPrice)}
              </Cell>
              <Cell w={COLS.taxable} align="right" mono color={colors.slate[700]}>
                {rupees(item.taxable)}
              </Cell>
              <Cell w={COLS.gst} align="center" bold color={colors.slate[600]}>
                {`${item.gstRate}%`}
              </Cell>
              <Cell w={COLS.tax} align="right" mono color={colors.slate[700]}>
                {rupees(item.tax)}
              </Cell>
              <Cell w={COLS.total} align="right" mono bold color={colors.slate[900]}>
                {rupees(item.total)}
              </Cell>
            </View>
          ))}

          {invoice.shipping !== null ? (
            <View style={styles.tr}>
              <View style={{ width: COLS.desc + COLS.hsn + COLS.qty + COLS.rate + COLS.taxable + COLS.gst + COLS.tax, paddingVertical: 8, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] }}>Shipping charges</Text>
              </View>
              <Cell w={COLS.total} align="right" mono bold color={colors.slate[900]}>
                {rupees(invoice.shipping)}
              </Cell>
            </View>
          ) : null}
          {invoice.platformFee > 0 ? (
            <View style={styles.tr}>
              <View style={{ width: COLS.desc + COLS.hsn + COLS.qty + COLS.rate + COLS.taxable + COLS.gst + COLS.tax, paddingVertical: 8, paddingHorizontal: 6 }}>
                <Text style={{ fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] }}>Platform fee</Text>
              </View>
              <Cell w={COLS.total} align="right" mono bold color={colors.slate[900]}>
                {rupees(invoice.platformFee)}
              </Cell>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Tax and totals */}
      <View style={styles.totalsWrap}>
        <View style={styles.taxBox}>
          <Text style={styles.taxBoxTitle}>{`TAX BREAKDOWN (${TAX_TYPE_LABEL[invoice.taxType].toUpperCase()})`}</Text>
          {invoice.taxType === 'INTER' ? <TaxRow label="Integrated GST (IGST)" value={rupees(totals.igst)} /> : null}
          {invoice.taxType === 'INTRA' ? (
            <>
              <TaxRow label="Central GST (CGST)" value={rupees(totals.cgst)} />
              <TaxRow label="State GST (SGST)" value={rupees(totals.sgst)} />
            </>
          ) : null}
          <Text style={styles.taxNote}>
            {isBillOfSupply
              ? 'The seller is not registered under GST, so no GST is charged on these items.'
              : 'All prices are inclusive of GST; the tax above is the part of the price that is GST.'}
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Row label="Items:" value={rupees(totals.gross)} />
          {totals.discount > 0 ? <Row label="Discount:" value={`- ${rupees(totals.discount)}`} color={colors.emerald[600]} /> : null}
          <Row label="Taxable value:" value={rupees(totals.taxable)} />
          <Row label="Total GST:" value={rupees(totals.tax)} />
          {totals.shipping > 0 ? <Row label="Shipping:" value={rupees(totals.shipping)} /> : null}
          {totals.platformFee > 0 ? <Row label="Platform fee:" value={rupees(totals.platformFee)} /> : null}
          <View style={styles.grandRow}>
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] }}>Invoice Total:</Text>
            <Text noTranslate style={{ fontSize: 14, lineHeight: 20, fontFamily: MONO, color: colors.blue[700] }}>
              {rupees(totals.total)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This is a computer-generated document and requires no physical signature under the IT Act, 2000.
        </Text>
        <Text style={[styles.footerText, { fontWeight: '600', color: colors.slate[700] }]}>
          Thank you for ordering with Krozenda Marketplace!
        </Text>
      </View>
    </View>
  )
}

function TaxRow({ label, value }) {
  return (
    <View style={[styles.kv, { paddingVertical: 2 }]}>
      <Text style={{ fontSize: 10, lineHeight: 15, color: colors.slate[700], fontWeight: '600' }}>{label}</Text>
      <Text noTranslate style={{ fontSize: 10, lineHeight: 15, color: colors.slate[700], fontFamily: MONO }}>
        {value}
      </Text>
    </View>
  )
}

// Every invoice of the order, with a note when there is more than one.
export function OrderInvoices({ data }) {
  const count = data.invoices.length
  if (count === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={{ fontSize: 12, lineHeight: 16, color: colors.slate[500], textAlign: 'center' }}>
          No invoice — every item on this order was cancelled.
        </Text>
      </View>
    )
  }
  return (
    <View style={{ gap: 16 }}>
      {count > 1 ? (
        <View style={styles.multiNote}>
          <Text style={{ fontSize: 11, lineHeight: 16.5, color: colors.blue[900] }}>
            {`This order has ${count} invoices because its items are sold by different sellers. Each invoice carries its seller's own GSTIN. Order total: `}
            <Text noTranslate style={{ fontWeight: '700', fontSize: 11, color: colors.blue[900] }}>
              {rupees(data.grandTotal)}
            </Text>
          </Text>
        </View>
      ) : null}
      {data.invoices.map((invoice, index) => (
        <TaxInvoiceDocument key={invoice.invoiceNumber} data={data} invoice={invoice} index={index} count={count} />
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Printable HTML (same layout) + print / share
// ---------------------------------------------------------------------------

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function invoiceHtml(data, invoice, index, count) {
  const { supplier, totals } = invoice
  const buyerAddress = data.buyer.address || {}
  const isPlatform = supplier.kind === 'PLATFORM'
  const isBillOfSupply = invoice.documentType === 'BILL_OF_SUPPLY'
  const supplierAddress = formatAddress(supplier.address)
  const buyerLine = `${esc(formatAddress(buyerAddress))} - ${esc(buyerAddress.pincode)}`

  const itemRows = invoice.items
    .map(
      (item) => `
      <tr>
        <td>
          <b>${esc(item.name)}</b>
          ${item.variant ? `<div class="muted">Variant: ${esc(item.variant)}</div>` : ''}
          ${item.discount > 0 ? `<div class="green">Discount: − ${esc(rupees(item.discount))}</div>` : ''}
        </td>
        <td class="c mono">${esc(item.hsnCode || '—')}</td>
        <td class="c"><b>${esc(item.quantity)}</b></td>
        <td class="r mono">${esc(rupees(item.unitPrice))}</td>
        <td class="r mono">${esc(rupees(item.taxable))}</td>
        <td class="c"><b>${esc(item.gstRate)}%</b></td>
        <td class="r mono">${esc(rupees(item.tax))}</td>
        <td class="r mono"><b>${esc(rupees(item.total))}</b></td>
      </tr>`,
    )
    .join('')

  const extraRow = (label, paise) => `
      <tr><td colspan="7"><b>${label}</b></td><td class="r mono"><b>${esc(rupees(paise))}</b></td></tr>`

  return `
  <div class="doc">
    <div class="head">
      <div class="left">
        ${
          isPlatform
            ? `<div class="platform">${esc(supplier.name)}</div>`
            : `<div class="label">SOLD BY</div><div class="seller">${esc(supplier.name)}</div>`
        }
        ${supplier.legalName && supplier.legalName !== supplier.name ? `<div class="legal">${esc(supplier.legalName)}</div>` : ''}
        ${
          supplierAddress
            ? `<div class="muted">${esc(supplierAddress)}${supplier.address.pincode ? ` - ${esc(supplier.address.pincode)}` : ''}</div>`
            : ''
        }
        <div class="gstin">${
          supplier.gstin
            ? `GSTIN: <span class="mono">${esc(supplier.gstin)}</span>`
            : '<span class="amber">Not registered under GST</span>'
        }${supplier.stateCode ? ` | State Code: ${esc(supplier.stateCode)}` : ''}</div>
        ${!isPlatform ? '<div class="muted">Sold on Krozenda Marketplace</div>' : ''}
      </div>
      <div class="right">
        <span class="pill">${isBillOfSupply ? 'BILL OF SUPPLY' : 'TAX INVOICE'}</span>
        <div class="inv">Invoice: <span class="mono">${esc(invoice.invoiceNumber)}</span></div>
        <div class="muted">Date: ${esc(formatDate(data.invoiceDate))}</div>
        <div class="muted">Order Ref: <span class="mono">${esc(data.orderNumber)}</span></div>
        ${count > 1 ? `<div class="muted">Invoice ${index + 1} of ${count}</div>` : ''}
      </div>
    </div>

    <div class="buyers">
      <div class="half">
        <div class="label">BILLED TO ${data.buyer.isB2B ? '<span class="b2b">B2B Buyer (ITC Eligible)</span>' : ''}</div>
        <div class="bname">${esc(data.buyer.companyName || data.buyer.name)}</div>
        ${data.buyer.gstin ? `<div class="bgstin">Buyer GSTIN: <span class="mono blue">${esc(data.buyer.gstin)}</span></div>` : ''}
        <div class="addr">${buyerLine}</div>
        <div class="phone">Phone: ${esc(buyerAddress.phone)}</div>
      </div>
      <div class="half">
        <div class="label">SHIPPED TO</div>
        <div class="bname2">${esc(data.buyer.name)}</div>
        <div class="addr">${buyerLine}</div>
        <div class="phone">Place of Supply: ${esc(data.placeOfSupply.stateName)}${
          data.placeOfSupply.stateCode ? ` (${esc(data.placeOfSupply.stateCode)})` : ''
        }</div>
        <div class="phone">Payment: ${esc(data.paymentMethod)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>DESCRIPTION</th><th class="c">HSN</th><th class="c">QTY</th><th class="r">RATE</th>
          <th class="r">TAXABLE</th><th class="c">GST %</th><th class="r">TAX</th><th class="r">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${invoice.shipping !== null ? extraRow('Shipping charges', invoice.shipping) : ''}
        ${invoice.platformFee > 0 ? extraRow('Platform fee', invoice.platformFee) : ''}
      </tbody>
    </table>

    <div class="totals">
      <div class="taxbox">
        <div class="taxtitle">TAX BREAKDOWN (${esc(TAX_TYPE_LABEL[invoice.taxType].toUpperCase())})</div>
        ${invoice.taxType === 'INTER' ? `<div class="kv mono"><span>Integrated GST (IGST)</span><span>${esc(rupees(totals.igst))}</span></div>` : ''}
        ${
          invoice.taxType === 'INTRA'
            ? `<div class="kv mono"><span>Central GST (CGST)</span><span>${esc(rupees(totals.cgst))}</span></div>
               <div class="kv mono"><span>State GST (SGST)</span><span>${esc(rupees(totals.sgst))}</span></div>`
            : ''
        }
        <div class="note">${
          isBillOfSupply
            ? 'The seller is not registered under GST, so no GST is charged on these items.'
            : 'All prices are inclusive of GST; the tax above is the part of the price that is GST.'
        }</div>
      </div>
      <div class="sum">
        <div class="kv"><span>Items:</span><span class="mono">${esc(rupees(totals.gross))}</span></div>
        ${totals.discount > 0 ? `<div class="kv green"><span>Discount:</span><span class="mono">- ${esc(rupees(totals.discount))}</span></div>` : ''}
        <div class="kv"><span>Taxable value:</span><span class="mono">${esc(rupees(totals.taxable))}</span></div>
        <div class="kv"><span>Total GST:</span><span class="mono">${esc(rupees(totals.tax))}</span></div>
        ${totals.shipping > 0 ? `<div class="kv"><span>Shipping:</span><span class="mono">${esc(rupees(totals.shipping))}</span></div>` : ''}
        ${totals.platformFee > 0 ? `<div class="kv"><span>Platform fee:</span><span class="mono">${esc(rupees(totals.platformFee))}</span></div>` : ''}
        <div class="kv grand"><span>Invoice Total:</span><span class="mono blue">${esc(rupees(totals.total))}</span></div>
      </div>
    </div>

    <div class="foot">
      <div>This is a computer-generated document and requires no physical signature under the IT Act, 2000.</div>
      <div><b>Thank you for ordering with Krozenda Marketplace!</b></div>
    </div>
  </div>`
}

const INVOICE_CSS = `
  @page { margin: 24px; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #1e293b; margin: 0; }
  .doc { padding: 4px 0 8px; page-break-after: always; }
  .doc:last-child { page-break-after: auto; }
  .mono { font-family: monospace; }
  .muted { font-size: 10px; color: #64748b; }
  .green { color: #047857; font-size: 10px; }
  .blue { color: #1d4ed8; }
  .amber { color: #b45309; font-weight: 600; }
  .label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .06em; }
  .head { display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; gap: 12px; }
  .head .right { text-align: right; flex-shrink: 0; }
  .platform { font-size: 24px; font-weight: 900; color: #1e3a8a; }
  .seller { font-size: 18px; font-weight: 900; color: #0f172a; }
  .legal { font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 2px; }
  .gstin { font-size: 10px; font-weight: 600; color: #334155; margin-top: 4px; }
  .pill { display: inline-block; background: #dbeafe; color: #1e3a8a; font-weight: 900; font-size: 10px; padding: 4px 10px; border-radius: 6px; letter-spacing: .05em; }
  .inv { font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 6px; }
  .buyers { display: flex; gap: 16px; border-bottom: 1px solid #e2e8f0; padding: 14px 0; }
  .half { flex: 1; }
  .b2b { background: #d1fae5; color: #065f46; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
  .bname { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px; }
  .bname2 { font-weight: 700; color: #0f172a; margin-top: 4px; }
  .bgstin { font-size: 11px; font-weight: 700; margin-top: 2px; }
  .addr { font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.3; }
  .phone { font-size: 10px; font-weight: 600; color: #334155; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 11px; }
  th { background: #f1f5f9; color: #334155; font-size: 9px; font-weight: 700; padding: 8px 6px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 8px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .c { text-align: center; } .r { text-align: right; }
  .totals { display: flex; gap: 20px; border-top: 1px solid #e2e8f0; margin-top: 12px; padding-top: 12px; align-items: flex-start; }
  .taxbox { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 10px; }
  .taxtitle { font-size: 9px; font-weight: 700; color: #1e293b; letter-spacing: .05em; margin-bottom: 4px; }
  .note { font-size: 9px; color: #64748b; padding-top: 4px; }
  .sum { width: 230px; font-size: 12px; }
  .kv { display: flex; justify-content: space-between; padding: 3px 0; color: #475569; }
  .grand { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 900; color: #0f172a; }
  .foot { border-top: 1px solid #f1f5f9; margin-top: 14px; padding-top: 10px; font-size: 10px; color: #64748b; }
`

export function buildInvoiceHtml(data) {
  const count = data.invoices.length
  const body =
    count === 0
      ? '<p style="text-align:center;color:#64748b">No invoice — every item on this order was cancelled.</p>'
      : data.invoices.map((invoice, index) => invoiceHtml(data, invoice, index, count)).join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${INVOICE_CSS}</style></head><body>${body}</body></html>`
}

// System print dialog (the Android print preview also offers "Save as PDF").
export async function printInvoice(data) {
  await Print.printAsync({ html: buildInvoiceHtml(data) })
}

// Renders the invoice to a PDF file and opens the share sheet.
export async function shareInvoicePdf(data) {
  const { uri } = await Print.printToFileAsync({ html: buildInvoiceHtml(data), width: 595, height: 842 })
  let fileUri = uri
  try {
    const safe = String(data.orderNumber || data.orderId).replace(/[^A-Za-z0-9_-]/g, '')
    const dest = new File(Paths.cache, `Krozenda-Invoice-${safe}.pdf`)
    if (dest.exists) dest.delete()
    await new File(uri).move(dest)
    if (dest.exists) fileUri = dest.uri
  } catch {
    // Keep the generated file's own name.
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.')
  }
  await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Tax Invoice' })
}

const styles = StyleSheet.create({
  doc: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    padding: 24,
    gap: 20,
    ...shadows.md,
  },
  section: { borderBottomWidth: 1, borderBottomColor: colors.slate[200], paddingBottom: 16 },
  soldBy: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: colors.slate[400], letterSpacing: 1 },
  platformName: { fontSize: 24, lineHeight: 32, fontWeight: '800', color: colors.blue[900], letterSpacing: -0.5 },
  sellerName: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.slate[900], letterSpacing: -0.4 },
  legalName: { marginTop: 2, fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[800] },
  small500: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },
  gstinLine: { marginTop: 4, fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.slate[700] },
  docTypePill: { backgroundColor: colors.blue[100], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  docTypeText: { fontSize: 10, lineHeight: 15, fontWeight: '800', color: colors.blue[900], letterSpacing: 1 },
  invNo: { marginTop: 6, fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[800] },
  b2bBadge: { backgroundColor: colors.emerald[100], paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  b2bBadgeText: { fontSize: 9, fontWeight: '700', color: colors.emerald[800] },
  buyerName: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.slate[900] },
  buyerGstin: { marginTop: 2, fontSize: 11, lineHeight: 16.5, fontWeight: '700', color: colors.slate[900] },
  buyerAddr: { marginTop: 4, fontSize: 11, lineHeight: 13.75, color: colors.slate[600] },
  phone: { marginTop: 2, fontSize: 10, lineHeight: 15, fontWeight: '600', color: colors.slate[700] },
  shipName: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.slate[900] },
  thead: { flexDirection: 'row', backgroundColor: colors.slate[100], borderBottomWidth: 1, borderBottomColor: colors.slate[200] },
  th: { fontSize: 9, lineHeight: 13.5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.slate[100] },
  totalsWrap: { borderTopWidth: 1, borderTopColor: colors.slate[200], paddingTop: 12, gap: 24 },
  taxBox: {
    backgroundColor: colors.slate[50],
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    gap: 6,
  },
  taxBoxTitle: { fontSize: 9, lineHeight: 13.5, fontWeight: '700', color: colors.slate[800], letterSpacing: 0.9 },
  taxNote: { fontSize: 9, lineHeight: 13.5, color: colors.slate[500], paddingTop: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.slate[200],
    paddingTop: 8,
  },
  footer: { borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: 12, gap: 2 },
  footerText: { fontSize: 10, lineHeight: 15, color: colors.slate[500] },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.slate[200],
    padding: 24,
  },
  multiNote: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.blue[100],
    backgroundColor: colors.blue[50],
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
})
