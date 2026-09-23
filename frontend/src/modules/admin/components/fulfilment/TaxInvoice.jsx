import React from 'react'
import { formatMoney } from '../../lib/format'

function numberToWords(amountInRupees) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const convertGroup = (num) => {
    let out = ''
    if (num >= 100) {
      out += ones[Math.floor(num / 100)] + ' Hundred '
      num %= 100
    }
    if (num >= 20) {
      out += tens[Math.floor(num / 10)] + ' '
      num %= 10
    }
    if (num > 0) {
      out += ones[num] + ' '
    }
    return out
  }

  const intPart = Math.floor(amountInRupees)
  if (intPart === 0) return 'Rupees Zero Only'

  let words = ''
  const crores = Math.floor(intPart / 10000000)
  const lakhs = Math.floor((intPart % 10000000) / 100000)
  const thousands = Math.floor((intPart % 100000) / 1000)
  const hundreds = intPart % 1000

  if (crores > 0) words += convertGroup(crores) + 'Crore '
  if (lakhs > 0) words += convertGroup(lakhs) + 'Lakh '
  if (thousands > 0) words += convertGroup(thousands) + 'Thousand '
  if (hundreds > 0) words += convertGroup(hundreds)

  return `Rupees ${words.trim()} Only`
}

export function TaxInvoice({ invoice }) {
  const isInterState = invoice.isInterState
  const totalRupees = invoice.total / 100

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm print:border-none print:shadow-none print:m-0 print:p-0">
      {/* Top Banner / Brand Header - Pure Crisp White */}
      <div className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-black tracking-tight text-slate-900">
                KROZENDA
              </span>
              <span className="rounded bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider">
                TAX INVOICE
              </span>
            </div>
            <p className="mt-1 text-2xs text-slate-500">
              Official GST Tax Invoice · Issued under Section 31 of CGST Act, 2017
            </p>
          </div>

          <div className="flex flex-col sm:items-end">
            <span className="inline-block rounded bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider">
              ORIGINAL FOR RECIPIENT
            </span>
            <p className="mt-1 font-mono text-lg font-bold tracking-tight text-slate-900">
              {invoice.number}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Meta Grid */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-3 text-xs sm:grid-cols-4 print:bg-transparent">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Invoice Date</span>
          <p className="mt-0.5 font-semibold text-slate-900">{invoice.issuedAt}</p>
        </div>
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Order / Sub-Order Ref</span>
          <p className="mt-0.5 font-mono font-semibold text-slate-900">{invoice.subOrderId}</p>
        </div>
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Place of Supply</span>
          <p className="mt-0.5 font-medium text-slate-900">{invoice.placeOfSupply}</p>
        </div>
        <div>
          <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Payment Status</span>
          <p className="mt-0.5 font-medium text-emerald-600 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Paid (Online Verified)
          </p>
        </div>
      </div>

      {/* Parties (Seller & Buyer) Section */}
      <div className="grid gap-6 border-b border-slate-200 p-6 md:grid-cols-2">
        {/* Sold By / Supplier Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 print:bg-white print:border-slate-300">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Sold By / Supplier Details
            </span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-2xs font-mono font-semibold text-slate-700">
              Registered Seller
            </span>
          </div>
          <div className="mt-2.5">
            <h4 className="text-sm font-bold text-slate-900">{invoice.seller.name}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{invoice.seller.address}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-2xs">
              <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-mono font-medium text-slate-800 shadow-2xs">
                GSTIN: <strong className="font-semibold text-slate-900">{invoice.seller.gstin}</strong>
              </span>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-medium text-slate-600 shadow-2xs">
                State: Maharashtra (27)
              </span>
            </div>
          </div>
        </div>

        {/* Billed & Delivered To / Customer Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 print:bg-white print:border-slate-300">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Billing & Delivery Details
            </span>
            <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-2xs font-medium">
              Consumer / Retail
            </span>
          </div>
          <div className="mt-2.5">
            <h4 className="text-sm font-bold text-slate-900">{invoice.buyerDetail.name}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{invoice.buyerDetail.address}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-2xs">
              <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-mono font-medium text-slate-800 shadow-2xs">
                GSTIN: {invoice.buyerDetail.gstin || 'Unregistered (B2C)'}
              </span>
              <span className="rounded-md bg-white border border-slate-200 px-2 py-1 font-medium text-slate-600 shadow-2xs">
                Supply: {invoice.placeOfSupply}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="admin-scroll overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[42rem] print:min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-2xs font-bold uppercase tracking-wider text-slate-700">
              <th className="w-10 px-4 py-3 text-center">#</th>
              <th className="px-4 py-3 text-left">Description of Goods</th>
              <th className="w-24 px-3 py-3 text-center">HSN/SAC</th>
              <th className="w-16 px-3 py-3 text-center">Qty</th>
              <th className="w-28 px-3 py-3 text-right">Taxable Val</th>
              <th className="w-32 px-3 py-3 text-right">
                {isInterState ? 'IGST (Rate)' : 'CGST + SGST'}
              </th>
              <th className="w-28 px-4 py-3 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.lines.map((line, idx) => (
              <tr key={line.name} className="hover:bg-slate-50/50">
                <td className="px-4 py-3.5 text-center font-mono text-2xs text-slate-400">
                  {idx + 1}
                </td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-slate-900 block">{line.name}</span>
                  <span className="text-2xs text-slate-500">Standard fulfillment warranty applies</span>
                </td>
                <td className="tabular px-3 py-3.5 text-center text-slate-600 font-mono text-xs">
                  {line.hsn}
                </td>
                <td className="tabular px-3 py-3.5 text-center font-bold text-slate-900 text-xs">
                  {line.quantity}
                </td>
                <td className="tabular px-3 py-3.5 text-right font-medium text-slate-800">
                  {formatMoney(line.taxableValue)}
                </td>
                <td className="tabular px-3 py-3.5 text-right text-slate-700">
                  <span>{formatMoney(isInterState ? line.igst : line.cgst * 2)}</span>
                  <span className="block text-2xs text-slate-500 font-medium">
                    {isInterState ? `${line.gstRate}% IGST` : `${line.gstRate / 2}% + ${line.gstRate / 2}%`}
                  </span>
                </td>
                <td className="tabular px-4 py-3.5 text-right font-bold text-slate-950 text-xs">
                  {formatMoney(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financials & Declaration Footer */}
      <div className="grid gap-6 border-t-2 border-slate-200 bg-slate-50/30 p-6 md:grid-cols-2 print:bg-white">
        {/* Left: Amount in Words & Legal Certification */}
        <div className="flex flex-col justify-between gap-5 text-xs text-slate-600">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Invoice Amount in Words:
            </span>
            <p className="mt-1 font-semibold text-slate-900 italic">
              {numberToWords(totalRupees)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-2xs space-y-1">
            <p className="font-bold text-slate-800 uppercase tracking-wide">Statutory Declarations:</p>
            <p className="text-slate-600 leading-normal">
              1. Whether tax is payable under Reverse Charge: <strong>No</strong>.
            </p>
            <p className="text-slate-600 leading-normal">
              2. Nature of Transaction: <strong>{isInterState ? 'Inter-State Supply (IGST)' : 'Intra-State Supply (CGST + SGST)'}</strong>.
            </p>
            <p className="text-slate-600 leading-normal">
              3. We declare that this invoice shows the actual price of goods described and particulars are true and correct.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200/80">
            <div>
              <p className="font-bold text-slate-900 text-xs">For {invoice.seller.name}:</p>
              <p className="text-2xs text-slate-500 mt-0.5">Authorized Signatory (Digital Signature)</p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded border border-emerald-500 bg-emerald-50 px-2 py-0.5 text-2xs font-bold text-emerald-800">
                VERIFIED DOCUMENT
              </span>
            </div>
          </div>
        </div>

        {/* Right: Calculations Summary Box */}
        <div className="flex flex-col justify-end">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total Taxable Value</span>
              <span className="tabular font-medium text-slate-900">{formatMoney(invoice.taxableValue)}</span>
            </div>

            {isInterState ? (
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Integrated GST (IGST 18%)</span>
                <span className="tabular font-medium text-slate-900">{formatMoney(invoice.gst)}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Central GST (CGST 9%)</span>
                  <span className="tabular font-medium text-slate-900">{formatMoney(invoice.gst / 2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>State GST (SGST 9%)</span>
                  <span className="tabular font-medium text-slate-900">{formatMoney(invoice.gst / 2)}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between text-xs text-slate-600 border-t border-dashed border-slate-200 pt-2">
              <span>Shipping & Delivery Fee</span>
              <span className="font-semibold text-emerald-600 uppercase text-2xs">Free / Included</span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Total Tax Amount</span>
              <span className="tabular font-semibold text-slate-900">{formatMoney(invoice.gst)}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900 mt-2 shadow-2xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Grand Total</span>
                <span className="block text-2xs text-slate-500">Inclusive of all taxes</span>
              </div>
              <span className="tabular text-xl font-black tracking-tight text-slate-950">
                {formatMoney(invoice.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
