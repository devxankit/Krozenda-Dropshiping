import React from 'react'
import { HiArrowLeft, HiArrowDownTray, HiPrinter } from 'react-icons/hi2'
import { useLocation } from 'react-router-dom'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { useOrderController } from '../../controllers/useOrdersController'

export function InvoicePreviewScreen({ onBack = () => {}, onDownload = () => {} }) {
  const location = useLocation()
  const orderId = location.state?.orderId
  const { order, isLoading, isError } = useOrderController(orderId)

  if (!orderId || isLoading) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center">
        <span className="text-xs font-semibold text-slate-400">{isLoading ? 'Loading invoice...' : 'No order selected'}</span>
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

      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors">
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Invoice Preview</h2>
          </div>
          <button onClick={() => window.print()} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
            <HiPrinter className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-md space-y-5 text-xs font-sans">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-2xl font-black text-blue-900">Krozenda</span>
                <p className="text-[10px] text-slate-500 mt-1 font-semibold">Krozenda E-Commerce Pvt. Ltd.</p>
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-blue-900 uppercase block tracking-wider">ORIGINAL TAX INVOICE</span>
                <p className="text-[10px] text-slate-600 font-bold mt-1">Invoice: {invoiceNo}</p>
                <p className="text-[10px] text-slate-500">Date: {date}</p>
              </div>
            </div>

            <div className="border-b border-slate-200 pb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To</span>
              <p className="font-bold text-slate-900 mt-0.5">{address.fullName}</p>
              <p className="text-[11px] text-slate-600 leading-tight">
                {[address.line1, address.line2, address.city, address.state].filter(Boolean).join(', ')} - {address.pincode}
              </p>
              <p className="text-[10px] font-semibold text-slate-700 mt-1">{address.phone}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-2">Description</th>
                    <th className="py-2.5 px-1 text-center">Qty</th>
                    <th className="py-2.5 px-1 text-right">Unit Price</th>
                    <th className="py-2.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 font-bold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-1 text-center">{item.quantity}</td>
                      <td className="py-2.5 px-1 text-right">₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-2 text-right font-bold">₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-end">
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <p>This is a computer generated invoice and does not require physical signature.</p>
                <p className="font-semibold text-slate-700">Thank you for shopping with Krozenda!</p>
              </div>

              <div className="w-full sm:w-48 space-y-1 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Sub Total:</span>
                  <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>- ₹{order.discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Shipping:</span>
                  <span>{order.shippingFee > 0 ? `₹${order.shippingFee.toLocaleString('en-IN')}` : 'FREE'}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Grand Total:</span>
                  <span>₹{order.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50 max-w-3xl mx-auto print:hidden">
        <button
          onClick={handleDownload}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
        >
          <HiArrowDownTray className="w-4 h-4" />
          <span>Download PDF Invoice</span>
        </button>
      </div>

      <div className="md:hidden print:hidden" />
    </div>
  )
}
