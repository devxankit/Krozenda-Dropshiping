import { formatMoney } from '../../lib/format'

// A GST tax invoice as it actually has to look: supplier and recipient with
// GSTINs, HSN per line, the tax split by head, and the place of supply. The
// preview is the document, not a summary of it.
export function TaxInvoice({ invoice }) {
  const isInterState = invoice.isInterState

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">
            Tax invoice
          </p>
          <p className="tabular mt-1 text-base font-bold text-slate-900">{invoice.number}</p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-ink-faint">Issued</p>
          <p className="text-xs font-semibold text-slate-900">{invoice.issuedAt}</p>
        </div>
      </header>

      <div className="grid gap-5 border-b border-border px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Supplier</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-900">{invoice.seller.name}</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{invoice.seller.address}</p>
          <p className="tabular mt-1 text-2xs text-ink-muted">GSTIN {invoice.seller.gstin}</p>
        </div>
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Recipient</p>
          <p className="mt-1.5 text-xs font-semibold text-slate-900">{invoice.buyerDetail.name}</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">
            {invoice.buyerDetail.address}
          </p>
          <p className="tabular mt-1 text-2xs text-ink-muted">
            {invoice.buyerDetail.gstin ? `GSTIN ${invoice.buyerDetail.gstin}` : 'Unregistered'}
          </p>
        </div>
      </div>

      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Description
              </th>
              <th className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                HSN
              </th>
              <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Qty
              </th>
              <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Taxable
              </th>
              <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                {isInterState ? 'IGST' : 'CGST'}
              </th>
              {!isInterState && (
                <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                  SGST
                </th>
              )}
              <th className="px-4 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.name} className="border-b border-border-subtle">
                <td className="px-4 py-2.5 text-slate-800">{line.name}</td>
                <td className="tabular px-3 py-2.5 text-ink-muted">{line.hsn}</td>
                <td className="tabular px-3 py-2.5 text-right text-ink-muted">{line.quantity}</td>
                <td className="tabular px-3 py-2.5 text-right text-slate-800">
                  {formatMoney(line.taxableValue)}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-ink-muted">
                  {formatMoney(isInterState ? line.igst : line.cgst)}
                  <span className="ml-1 text-2xs text-ink-faint">
                    {isInterState ? `${line.gstRate}%` : `${line.gstRate / 2}%`}
                  </span>
                </td>
                {!isInterState && (
                  <td className="tabular px-3 py-2.5 text-right text-ink-muted">
                    {formatMoney(line.sgst)}
                  </td>
                )}
                <td className="tabular px-4 py-2.5 text-right font-semibold text-slate-900">
                  {formatMoney(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col items-end gap-1 border-t border-border px-5 py-4">
        <div className="flex w-56 items-baseline justify-between text-xs">
          <span className="text-ink-subtle">Taxable value</span>
          <span className="tabular text-slate-800">{formatMoney(invoice.taxableValue)}</span>
        </div>
        <div className="flex w-56 items-baseline justify-between text-xs">
          <span className="text-ink-subtle">{isInterState ? 'IGST' : 'CGST + SGST'}</span>
          <span className="tabular text-slate-800">{formatMoney(invoice.gst)}</span>
        </div>
        <div className="mt-1 flex w-56 items-baseline justify-between border-t border-border pt-2 text-sm">
          <span className="font-semibold text-slate-900">Invoice total</span>
          <span className="tabular font-bold text-slate-900">{formatMoney(invoice.total)}</span>
        </div>
        <p className="mt-2 text-2xs text-ink-faint">
          Place of supply: {invoice.placeOfSupply} · Computer-generated, no signature required
        </p>
      </footer>
    </article>
  )
}
