import { HiArrowLeft, HiArrowDownTray, HiPrinter } from 'react-icons/hi2'
import { useNavigate, useParams } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrderController } from '../../controllers/useOrdersController'

export function InvoiceDownloadScreen() {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const { order, isLoading, isError } = useOrderController(orderId)

  usePageMeta({ title: 'Invoice', noindex: true })

  const onBack = () => navigate(-1)
  const onDownload = (id) => navigate(userPath.orderInvoicePreview(id))

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
        <span className="text-xs font-semibold text-slate-400" role="status">Loading invoice…</span>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Invoice unavailable</h2>
        <button onClick={onBack} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl">
          Back
        </button>
      </div>
    )
  }

  const invoiceNo = `INV-${order.id.slice(-10).toUpperCase()}`
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const address = order.shippingAddress

  const handleDownload = () => {
    window.print()
    onDownload(order.id)
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      <div className="hidden md:block print:hidden"><WebHeader /></div>

      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Tax Invoice</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => window.print()} title="Print Invoice" className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiPrinter className="w-5 h-5" />
            </button>
            <button onClick={handleDownload} title="Download / Save" className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowDownTray className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4 text-xs font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 pb-4 gap-3">
              <div>
                <span className="text-2xl font-black text-blue-900 tracking-tight">Krozenda</span>
                <p className="text-[11px] text-slate-800 font-bold mt-0.5">Krozenda E-Commerce Pvt. Ltd.</p>
                <p className="text-[10px] text-slate-500">Registered Office: Bandra Kurla Complex, Mumbai, Maharashtra - 400051</p>
                <p className="text-[10px] text-slate-700 font-semibold mt-1">
                  GSTIN: <span className="font-mono font-bold text-slate-900">27AAECK4821M1Z9</span> | State Code: 27
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="inline-block bg-blue-100 text-blue-900 font-black text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider">
                  TAX INVOICE
                </span>
                <p className="text-[11px] text-slate-800 font-bold mt-1.5">Invoice: <span className="font-mono">{invoiceNo}</span></p>
                <p className="text-[10px] text-slate-500">Date: {date}</p>
                <p className="text-[10px] text-slate-500">Order Ref: <span className="font-mono">#{order.id.slice(-8).toUpperCase()}</span></p>
              </div>
            </div>

            {/* Bill To & Ship To Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
                  {order.b2b?.isB2B && (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                      B2B Buyer (ITC Eligible)
                    </span>
                  )}
                </div>
                {order.b2b?.isB2B && order.b2b?.companyName ? (
                  <p className="font-black text-slate-900 text-sm mt-1">{order.b2b.companyName}</p>
                ) : (
                  <p className="font-bold text-slate-900 mt-1">{address.fullName}</p>
                )}
                {order.b2b?.gstin && (
                  <p className="text-[11px] font-bold text-slate-900 mt-0.5">
                    Buyer GSTIN: <span className="font-mono text-blue-700 font-bold">{order.b2b.gstin}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-600 leading-tight mt-1">
                  {[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - {address.pincode}
                </p>
                <p className="text-[10px] font-semibold text-slate-700 mt-0.5">Phone: {address.phone}</p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shipped To</span>
                <p className="font-bold text-slate-900 mt-1">{address.fullName}</p>
                <p className="text-[11px] text-slate-600 leading-tight mt-1">
                  {[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - {address.pincode}
                </p>
                <p className="text-[10px] font-semibold text-slate-700 mt-0.5">State: {address.state}</p>
                <p className="text-[10px] font-semibold text-slate-700">Payment: {order.paymentMethod}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-2">Description</th>
                    <th className="py-2.5 px-1.5 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-1 text-center">Qty</th>
                    <th className="py-2.5 px-1.5 text-right">Unit Rate</th>
                    <th className="py-2.5 px-1.5 text-right">Taxable Val</th>
                    <th className="py-2.5 px-1 text-center">GST %</th>
                    <th className="py-2.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {order.items.map((item, idx) => {
                    const gstRate = item.gstRate || 18
                    const gross = item.price * item.quantity
                    const taxable = item.taxableValue > 0 ? item.taxableValue / 100 : Math.round(gross / (1 + gstRate / 100))
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-2">
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          {item.variant && <span className="text-[10px] text-slate-500 font-normal">Variant: {item.variant}</span>}
                        </td>
                        <td className="py-2 px-1.5 text-center font-mono text-[10px] text-slate-600">
                          {item.hsnCode || '998311'}
                        </td>
                        <td className="py-2 px-1 text-center font-semibold">{item.quantity}</td>
                        <td className="py-2 px-1.5 text-right font-mono">₹{item.price.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-1.5 text-right font-mono text-slate-700">₹{taxable.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-1 text-center font-semibold text-slate-600">{gstRate}%</td>
                        <td className="py-2 px-2 text-right font-bold font-mono text-slate-900">
                          ₹{gross.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tax Breakdown & Totals */}
            <div className="border-t border-slate-200 pt-3 flex flex-col md:flex-row justify-between gap-6 items-start">
              {/* Tax Details Grid */}
              <div className="w-full md:w-3/5 bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-[10px]">
                <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">
                  Tax Breakdown ({order.b2b?.gstin && !order.b2b.gstin.startsWith('27') ? 'Inter-State IGST' : 'Intra-State CGST + SGST'})
                </p>
                <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px]">
                  <span>Tax Type</span>
                  <span className="text-center">Rate</span>
                  <span className="text-right">Amount (₹)</span>
                </div>
                {order.b2b?.gstin && !order.b2b.gstin.startsWith('27') ? (
                  <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
                    <span>Integrated GST (IGST)</span>
                    <span className="text-right">Included in Price</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
                      <span>Central GST (CGST)</span>
                      <span className="text-right">Included in Price</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-slate-700 font-semibold font-mono">
                      <span>State GST (SGST)</span>
                      <span className="text-right">Included in Price</span>
                    </div>
                  </>
                )}
                <p className="text-[9px] text-slate-500 pt-1">
                  All unit rates are inclusive of Goods and Services Tax (GST) under Indian Law.
                </p>
              </div>

              {/* Amount Summary */}
              <div className="w-full md:w-56 space-y-1.5 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal:</span>
                  <span className="font-mono">₹{order.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono">- ₹{order.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Shipping:</span>
                  <span className="font-mono">{order.shippingFee > 0 ? `₹${order.shippingFee.toLocaleString('en-IN')}` : 'FREE'}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono text-blue-700">₹{order.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-500 text-center sm:text-left space-y-0.5">
              <p>This is a computer-generated tax invoice and requires no physical signature under the IT Act, 2000.</p>
              <p className="font-semibold text-slate-700">Thank you for ordering with Krozenda Marketplace!</p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide print:hidden flex items-center justify-center space-x-2"
          >
            <HiArrowDownTray className="w-4 h-4" />
            <span>Download / Print Invoice</span>
          </button>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 print:hidden">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}
