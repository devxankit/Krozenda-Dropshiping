import { HiArrowLeft, HiArrowDownTray } from 'react-icons/hi2'
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
            <h2 className="text-base font-bold text-slate-900">Invoice</h2>
          </div>
          <button onClick={handleDownload} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
            <HiArrowDownTray className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <span className="text-base font-black text-blue-900">Krozenda</span>
              <div className="text-right">
                <span className="text-sm font-black text-slate-900 uppercase block tracking-wider">Tax Invoice</span>
                <p className="text-[10px] text-slate-500 font-medium">Invoice No. {invoiceNo}</p>
                <p className="text-[10px] text-slate-500 font-medium">Date: {date}</p>
              </div>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bill To</span>
              <p className="font-bold text-slate-900 mt-0.5">{address.fullName}</p>
              <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                {[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - {address.pincode}
              </p>
              <p className="text-[10px] font-semibold text-slate-700 mt-1">{address.phone}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2 pr-2">Item</th>
                    <th className="py-2 px-1 text-center">Qty</th>
                    <th className="py-2 px-1 text-right">Price</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2 font-bold text-slate-900">{item.name}</td>
                      <td className="py-2 px-1 text-center">{item.quantity}</td>
                      <td className="py-2 px-1 text-right">₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="py-2 pl-2 text-right font-bold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total</span>
                <span className="font-semibold text-slate-900">₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span>- ₹{order.discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping Charges</span>
                <span className="font-bold text-emerald-600 uppercase">{order.shippingFee > 0 ? `₹${order.shippingFee.toLocaleString('en-IN')}` : 'FREE'}</span>
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline font-bold text-xs">
                <span className="text-slate-900">Total Amount (Incl. Taxes)</span>
                <span className="text-sm font-black text-slate-900">₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide print:hidden"
          >
            Download Invoice
          </button>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 print:hidden">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}
