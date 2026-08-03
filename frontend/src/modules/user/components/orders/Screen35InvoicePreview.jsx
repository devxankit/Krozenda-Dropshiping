import React from 'react'
import { HiArrowLeft, HiArrowDownTray, HiPrinter, HiShare } from 'react-icons/hi2'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { WebHeader } from '../../../../components/layout/WebHeader'

export function Screen35InvoicePreview({
  invoiceNo = 'INV-KRO-1234567890',
  date = '12 May 2024',
  onBack = () => {},
  onDownload = () => {},
}) {
  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col justify-between text-slate-800 font-sans">
      {/* DESKTOP WEB HEADER */}
      <div className="hidden md:block">
        <WebHeader />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pb-24 md:pb-12 max-w-3xl mx-auto w-full md:px-6 md:py-6">
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
            <h2 className="text-base font-bold text-slate-900">Invoice Preview (PDF)</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiPrinter className="w-5 h-5" />
            </button>
            <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700">
              <HiShare className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Document Preview Canvas */}
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-md space-y-5 text-xs font-sans">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <img src="/images/logo.png" alt="KroZenda Logo" className="h-10 w-auto object-contain" />
                <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                  KroZenda E-Commerce Pvt. Ltd.<br />
                  SG Highway, Ahmedabad, Gujarat - 380051
                </p>
              </div>

              <div className="text-right">
                <span className="text-sm font-black text-blue-900 uppercase block tracking-wider">
                  ORIGINAL TAX INVOICE
                </span>
                <p className="text-[10px] text-slate-600 font-bold mt-1">Invoice: {invoiceNo}</p>
                <p className="text-[10px] text-slate-500">Date: {date}</p>
              </div>
            </div>

            {/* Buyer Details */}
            <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Billed To
                </span>
                <p className="font-bold text-slate-900 mt-0.5">Rahul Sharma</p>
                <p className="text-[11px] text-slate-600 leading-tight">
                  123, Sunrise Apartments, Near SG Highway, Ahmedabad, Gujarat - 380051
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Supplier GSTIN
                </span>
                <p className="font-bold text-slate-900 mt-0.5">24AAACK1234F1Z5</p>
                <p className="text-[10px] text-slate-500">Place of Supply: Gujarat (24)</p>
              </div>
            </div>

            {/* Tax Details Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] border-b border-slate-200">
                    <th className="py-2.5 px-2">Description</th>
                    <th className="py-2.5 px-1 text-center">HSN</th>
                    <th className="py-2.5 px-1 text-center">Qty</th>
                    <th className="py-2.5 px-1 text-right">Unit Price</th>
                    <th className="py-2.5 px-1 text-right">Taxable</th>
                    <th className="py-2.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="py-2.5 px-2 font-bold text-slate-900">Samsung Galaxy S23 5G (128GB)</td>
                    <td className="py-2.5 px-1 text-center text-slate-500 text-[10px]">85171200</td>
                    <td className="py-2.5 px-1 text-center">1</td>
                    <td className="py-2.5 px-1 text-right">₹49,999</td>
                    <td className="py-2.5 px-1 text-right">₹49,999</td>
                    <td className="py-2.5 px-2 text-right font-bold">₹49,999</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2 font-bold text-slate-900">boAt Airdopes 141 Wireless Earbuds</td>
                    <td className="py-2.5 px-1 text-center text-slate-500 text-[10px]">85163000</td>
                    <td className="py-2.5 px-1 text-center">1</td>
                    <td className="py-2.5 px-1 text-right">₹1,299</td>
                    <td className="py-2.5 px-1 text-right">₹1,299</td>
                    <td className="py-2.5 px-2 text-right font-bold">₹1,299</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Calculations */}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-end">
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <p>This is a computer generated invoice and does not require physical signature.</p>
                <p className="font-semibold text-slate-700">Thank you for shopping with KroZenda!</p>
              </div>

              <div className="w-48 space-y-1 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>CGST @ 9%:</span>
                  <span>₹2,475</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST @ 9%:</span>
                  <span>₹2,475</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                  <span>Grand Total:</span>
                  <span>₹49,298</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Download Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-lg z-50 max-w-3xl mx-auto">
        <button
          onClick={onDownload}
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
        >
          <HiArrowDownTray className="w-4 h-4" />
          <span>Download PDF Invoice</span>
        </button>
      </div>
    </div>
  )
}
