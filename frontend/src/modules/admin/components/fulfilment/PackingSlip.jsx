import React from 'react'

// A warehouse packing slip for fulfillment verification: shows sub-order ref,
// dispatch and delivery locations, items, HSN, quantities, and a check box
// for packer verification without showing taxation/rates.
export function PackingSlip({ invoice }) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface print:border-none print:shadow-none print:bg-white print:text-black">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <span className="inline-block rounded bg-brand-50 border border-brand-200 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-brand-700">
            Packing Slip
          </span>
          <p className="tabular mt-2 text-base font-bold text-slate-900">{invoice.subOrderId}</p>
          <p className="text-2xs text-ink-subtle mt-0.5">Invoice Ref: {invoice.number}</p>
        </div>
        <div className="text-right">
          <p className="text-2xs text-ink-faint">Date Issued</p>
          <p className="text-xs font-semibold text-slate-900">{invoice.issuedAt}</p>
          <p className="text-2xs font-semibold text-brand-700 mt-1 uppercase tracking-wide">Krozenda Fulfillment</p>
        </div>
      </header>

      <div className="grid gap-5 border-b border-border px-5 py-4 sm:grid-cols-2">
        <div className="rounded-lg bg-surface-muted/50 p-3.5 border border-border-subtle print:bg-transparent">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Dispatch From (Supplier)</p>
          <p className="mt-1 text-xs font-bold text-slate-900">{invoice.seller.name}</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{invoice.seller.address}</p>
          <p className="tabular mt-1 text-2xs text-ink-muted">GSTIN: {invoice.seller.gstin}</p>
        </div>
        <div className="rounded-lg bg-surface-muted/50 p-3.5 border border-border-subtle print:bg-transparent">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Deliver To (Customer)</p>
          <p className="mt-1 text-xs font-bold text-slate-900">{invoice.buyerDetail.name}</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{invoice.buyerDetail.address}</p>
          {invoice.buyerDetail.gstin && (
            <p className="tabular mt-1 text-2xs text-ink-muted">GSTIN: {invoice.buyerDetail.gstin}</p>
          )}
        </div>
      </div>

      <div className="admin-scroll overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[32rem] print:min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-muted print:bg-slate-100">
              <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint w-12">
                #
              </th>
              <th className="px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                Item Description
              </th>
              <th className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-ink-faint w-24">
                HSN
              </th>
              <th className="px-3 py-2.5 text-center text-2xs font-semibold uppercase tracking-wider text-ink-faint w-24">
                Quantity
              </th>
              <th className="px-4 py-2.5 text-center text-2xs font-semibold uppercase tracking-wider text-ink-faint w-24">
                Check
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.name} className="border-b border-border-subtle">
                <td className="px-4 py-3 text-2xs text-ink-faint font-mono">{idx + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{line.name}</td>
                <td className="tabular px-3 py-3 text-ink-muted">{line.hsn}</td>
                <td className="tabular px-3 py-3 text-center font-bold text-slate-900 text-sm">
                  {line.quantity}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-block w-5 h-5 border-2 border-slate-300 rounded print:border-black" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 text-2xs text-ink-subtle">
        <div>
          <p className="font-semibold text-slate-700">Warehouse Verification Checklist:</p>
          <div className="mt-3 flex gap-8">
            <p>Packed by: ____________________</p>
            <p>Checked by: ____________________</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-ink-faint">
            Order Ref: <span className="font-mono font-medium text-slate-900">{invoice.subOrderId}</span>
          </p>
          <p className="mt-1">Please verify all package contents and quantities before dispatch.</p>
        </div>
      </footer>
    </article>
  )
}
