import React from 'react'
import { HiArrowLeft, HiArrowDownTray } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen24InvoiceDownload({
  invoiceNo = 'INV-KRO-1234567890',
  date = '12 May 2024',
  onBack = () => {},
  onDownload = () => {},
}) {
  const invoiceItems = [
    {
      name: 'Samsung Galaxy S23 5G',
      hsn: '85171200',
      qty: 1,
      price: 49999,
      total: 49999,
    },
    {
      name: 'boAt Airdopes 141',
      hsn: '85163000',
      qty: 1,
      price: 1299,
      total: 1299,
    },
    {
      name: 'Portronics Power Bank',
      hsn: '85076000',
      qty: 1,
      price: 1199,
      total: 1199,
    },
  ]

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-20 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
        {/* MOBILE STATUS BAR */}
        <div className="md:hidden">
          <div className="w-full px-6 pt-3 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white">
            <span>9:41</span>
            <div className="flex items-center space-x-1.5 text-xs">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>
        </div>

        {/* Top Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <HiArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-900">Invoice</h2>
          </div>
          <button
            onClick={onDownload}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowDownTray className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Tax Invoice Document Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4 text-xs">
            {/* Invoice Top Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <img src="/images/logo.png" alt="KroZenda" className="h-9 w-auto object-contain" />
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-slate-900 uppercase block tracking-wider">
                  Tax Invoice
                </span>
                <p className="text-[10px] text-slate-500 font-medium">Invoice No. {invoiceNo}</p>
                <p className="text-[10px] text-slate-500 font-medium">Date: {date}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bill To
              </span>
              <p className="font-bold text-slate-900 mt-0.5">Rahul Sharma</p>
              <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051
              </p>
              <p className="text-[10px] font-semibold text-slate-700 mt-1">GSTIN: 24ABCDE1234F1Z5</p>
            </div>

            {/* GST Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2 pr-2">Item</th>
                    <th className="py-2 px-1">HSN</th>
                    <th className="py-2 px-1 text-center">Qty</th>
                    <th className="py-2 px-1 text-right">Price</th>
                    <th className="py-2 pl-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2 font-bold text-slate-900">{item.name}</td>
                      <td className="py-2 px-1 text-slate-500 text-[10px]">{item.hsn}</td>
                      <td className="py-2 px-1 text-center">{item.qty}</td>
                      <td className="py-2 px-1 text-right">₹{item.price.toLocaleString('en-IN')}</td>
                      <td className="py-2 pl-2 text-right font-bold">₹{item.total.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Sub Total</span>
                <span className="font-semibold text-slate-900">₹52,497</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount</span>
                <span>- ₹3,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping Charges</span>
                <span className="font-bold text-emerald-600 uppercase">₹0</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span className="font-semibold text-slate-900">₹49,497</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>CGST (9%)</span>
                <span>₹2,475</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>SGST (9%)</span>
                <span>₹2,475</span>
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline font-bold text-xs">
                <span className="text-slate-900">Total Amount</span>
                <span className="text-sm font-black text-slate-900">₹49,298</span>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 font-medium italic">
                Amount in Words: Forty Nine Thousand Two Hundred Ninety Eight Only
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={onDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide"
          >
            Download Invoice
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAVBAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <BottomNavbar activeTab="orders" />
      </div>
    </div>
  )
}
