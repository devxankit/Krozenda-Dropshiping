// One supplier's tax invoice for an order. An order with items from several
// suppliers has several of these — Krozenda's (own stock, CJ Dropshipping and
// shipping) and one per seller — each printed with that supplier's own GSTIN.
// Everything shown comes from GET /user/orders/:id/invoice; nothing here
// decides GST treatment.

const rupees = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TAX_TYPE_LABEL = Object.freeze({
  INTRA: 'Intra-State: CGST + SGST',
  INTER: 'Inter-State: IGST',
  NONE: 'No GST charged',
})

function formatAddress(address = {}) {
  return [address.addressLine || address.line1, address.line2, address.city, address.state]
    .filter(Boolean)
    .join(', ')
}

export function TaxInvoiceDocument({ data, invoice, index, count }) {
  const { supplier, totals } = invoice
  const buyerAddress = data.buyer.address || {}
  const date = new Date(data.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const isPlatform = supplier.kind === 'PLATFORM'
  const isBillOfSupply = invoice.documentType === 'BILL_OF_SUPPLY'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-md space-y-5 text-xs font-sans break-after-page print:shadow-none">
      {/* Supplier (whoever sold these items) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 pb-4 gap-3">
        <div>
          {isPlatform ? (
            <span className="text-2xl font-black text-blue-900 tracking-tight">{supplier.name}</span>
          ) : (
            <>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sold by</span>
              <span className="text-lg font-black text-slate-900 tracking-tight">{supplier.name}</span>
            </>
          )}
          {supplier.legalName && supplier.legalName !== supplier.name && (
            <p className="text-[11px] text-slate-800 font-bold mt-0.5">{supplier.legalName}</p>
          )}
          {formatAddress(supplier.address) && (
            <p className="text-[10px] text-slate-500">
              {formatAddress(supplier.address)}
              {supplier.address.pincode ? ` - ${supplier.address.pincode}` : ''}
            </p>
          )}
          <p className="text-[10px] text-slate-700 font-semibold mt-1">
            {supplier.gstin ? (
              <>
                GSTIN: <span className="font-mono font-bold text-slate-900">{supplier.gstin}</span>
              </>
            ) : (
              <span className="text-amber-700">Not registered under GST</span>
            )}
            {supplier.stateCode && ` | State Code: ${supplier.stateCode}`}
          </p>
          {!isPlatform && (
            <p className="text-[10px] text-slate-500 mt-0.5">Sold on Krozenda Marketplace</p>
          )}
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="inline-block bg-blue-100 text-blue-900 font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider">
            {isBillOfSupply ? 'Bill of Supply' : 'Tax Invoice'}
          </span>
          <p className="text-[11px] text-slate-800 font-bold mt-1.5">
            Invoice: <span className="font-mono">{invoice.invoiceNumber}</span>
          </p>
          <p className="text-[10px] text-slate-500">Date: {date}</p>
          <p className="text-[10px] text-slate-500">
            Order Ref: <span className="font-mono">{data.orderNumber}</span>
          </p>
          {count > 1 && (
            <p className="text-[10px] text-slate-500">
              Invoice {index + 1} of {count}
            </p>
          )}
        </div>
      </div>

      {/* Buyer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
            {data.buyer.isB2B && (
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                B2B Buyer (ITC Eligible)
              </span>
            )}
          </div>
          <p className="font-black text-slate-900 text-sm mt-1">{data.buyer.companyName || data.buyer.name}</p>
          {data.buyer.gstin && (
            <p className="text-[11px] font-bold text-slate-900 mt-0.5">
              Buyer GSTIN: <span className="font-mono text-blue-700 font-bold">{data.buyer.gstin}</span>
            </p>
          )}
          <p className="text-[11px] text-slate-600 leading-tight mt-1">
            {formatAddress(buyerAddress)} - {buyerAddress.pincode}
          </p>
          <p className="text-[10px] font-semibold text-slate-700 mt-0.5">Phone: {buyerAddress.phone}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shipped To</span>
          <p className="font-bold text-slate-900 mt-1">{data.buyer.name}</p>
          <p className="text-[11px] text-slate-600 leading-tight mt-1">
            {formatAddress(buyerAddress)} - {buyerAddress.pincode}
          </p>
          <p className="text-[10px] font-semibold text-slate-700 mt-0.5">
            Place of Supply: {data.placeOfSupply.stateName}
            {data.placeOfSupply.stateCode && ` (${data.placeOfSupply.stateCode})`}
          </p>
          <p className="text-[10px] font-semibold text-slate-700">Payment: {data.paymentMethod}</p>
        </div>
      </div>

      {/* Lines */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
              <th className="py-2.5 px-2">Description</th>
              <th className="py-2.5 px-1.5 text-center">HSN</th>
              <th className="py-2.5 px-1 text-center">Qty</th>
              <th className="py-2.5 px-1.5 text-right">Rate</th>
              <th className="py-2.5 px-1.5 text-right">Taxable</th>
              <th className="py-2.5 px-1 text-center">GST %</th>
              <th className="py-2.5 px-1.5 text-right">Tax</th>
              <th className="py-2.5 px-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-800">
            {invoice.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-2 px-2">
                  <span className="font-bold text-slate-900 block">{item.name}</span>
                  {item.variant && <span className="text-[10px] text-slate-500 font-normal">Variant: {item.variant}</span>}
                  {item.discount > 0 && (
                    <span className="text-[10px] text-emerald-700 font-normal block">Discount: − {rupees(item.discount)}</span>
                  )}
                </td>
                <td className="py-2 px-1.5 text-center font-mono text-[10px] text-slate-600">{item.hsnCode || '—'}</td>
                <td className="py-2 px-1 text-center font-semibold">{item.quantity}</td>
                <td className="py-2 px-1.5 text-right font-mono">{rupees(item.unitPrice)}</td>
                <td className="py-2 px-1.5 text-right font-mono text-slate-700">{rupees(item.taxable)}</td>
                <td className="py-2 px-1 text-center font-semibold text-slate-600">{item.gstRate}%</td>
                <td className="py-2 px-1.5 text-right font-mono text-slate-700">{rupees(item.tax)}</td>
                <td className="py-2 px-2 text-right font-bold font-mono text-slate-900">{rupees(item.total)}</td>
              </tr>
            ))}
            {invoice.shipping !== null && (
              <tr>
                <td className="py-2 px-2 font-bold text-slate-900" colSpan={7}>
                  Shipping charges
                </td>
                <td className="py-2 px-2 text-right font-bold font-mono text-slate-900">{rupees(invoice.shipping)}</td>
              </tr>
            )}
            {invoice.platformFee > 0 && (
              <tr>
                <td className="py-2 px-2 font-bold text-slate-900" colSpan={7}>
                  Platform fee
                </td>
                <td className="py-2 px-2 text-right font-bold font-mono text-slate-900">{rupees(invoice.platformFee)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tax and totals */}
      <div className="border-t border-slate-200 pt-3 flex flex-col md:flex-row justify-between gap-6 items-start">
        <div className="w-full md:w-3/5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-[10px]">
          <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">
            Tax Breakdown ({TAX_TYPE_LABEL[invoice.taxType]})
          </p>
          {invoice.taxType === 'INTER' && (
            <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
              <span>Integrated GST (IGST)</span>
              <span>{rupees(totals.igst)}</span>
            </div>
          )}
          {invoice.taxType === 'INTRA' && (
            <>
              <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
                <span>Central GST (CGST)</span>
                <span>{rupees(totals.cgst)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
                <span>State GST (SGST)</span>
                <span>{rupees(totals.sgst)}</span>
              </div>
            </>
          )}
          <p className="text-[9px] text-slate-500 pt-1">
            {isBillOfSupply
              ? 'The seller is not registered under GST, so no GST is charged on these items.'
              : 'All prices are inclusive of GST; the tax above is the part of the price that is GST.'}
          </p>
        </div>

        <div className="w-full md:w-56 space-y-1.5 text-right text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Items:</span>
            <span className="font-mono">{rupees(totals.gross)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount:</span>
              <span className="font-mono">- {rupees(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>Taxable value:</span>
            <span className="font-mono">{rupees(totals.taxable)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total GST:</span>
            <span className="font-mono">{rupees(totals.tax)}</span>
          </div>
          {totals.shipping > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Shipping:</span>
              <span className="font-mono">{rupees(totals.shipping)}</span>
            </div>
          )}
          {totals.platformFee > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Platform fee:</span>
              <span className="font-mono">{rupees(totals.platformFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-2">
            <span>Invoice Total:</span>
            <span className="font-mono text-blue-700">{rupees(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-500 text-center sm:text-left space-y-0.5">
        <p>This is a computer-generated document and requires no physical signature under the IT Act, 2000.</p>
        <p className="font-semibold text-slate-700">Thank you for ordering with Krozenda Marketplace!</p>
      </div>
    </div>
  )
}

// Every invoice of the order, with a note when there is more than one.
export function OrderInvoices({ data }) {
  const count = data.invoices.length
  if (count === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
        No invoice — every item on this order was cancelled.
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {count > 1 && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-900 print:hidden">
          This order has {count} invoices because its items are sold by different sellers. Each invoice carries
          its seller&apos;s own GSTIN. Order total: <span className="font-bold">{rupees(data.grandTotal)}</span>
        </div>
      )}
      {data.invoices.map((invoice, index) => (
        <TaxInvoiceDocument key={invoice.invoiceNumber} data={data} invoice={invoice} index={index} count={count} />
      ))}
    </div>
  )
}
